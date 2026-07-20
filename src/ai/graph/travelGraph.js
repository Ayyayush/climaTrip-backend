const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { createLLM } = require("../config/llm");
const { travelPlannerPrompt, buildAgentPrompt } = require("../prompts/travelPrompts");
const {
    travelPlanParser,
    travelPlanSchema,
    agentNoteParser,
} = require("../schemas/travelPlanSchema");
const { retrieveContext } = require("../retrieval/vectorStore");
const { weatherTool, distanceTool } = require("../tools");
const withRetry = require("../utils/withRetry");
const logger = require("../../utils/logger");

// ============================================================
// Multi-agent workflow (Part 9):
//
//                         START
//                           |
//                        Planner
//                           |
//        -----------------------------------------------
//        |         |          |        |        |        |
//     Weather   Budget    Transport   Hotel  Restaurant Safety   <- parallel
//        |         |          |        |        |        |
//        -----------------------------------------------
//                           |
//                         Merge
//                           |
//                  Generate Final Itinerary
//                           |
//                          END
//
// Every LLM call (planner, each parallel agent, and the final itinerary
// generator) goes through a StructuredOutputParser — nothing free-forms
// text back to a caller.
// ============================================================

const TravelState = Annotation.Root({
    source: Annotation(),
    destination: Annotation(),
    startDate: Annotation(),
    endDate: Annotation(),
    preferences: Annotation({ default: () => "none known yet" }),
    ragContext: Annotation({ default: () => "" }),
    toolResults: Annotation({
        default: () => ({}),
        reducer: (existing, update) => ({ ...existing, ...update }),
    }),
    agentNotes: Annotation({
        default: () => ({}),
        reducer: (existing, update) => ({ ...existing, ...update }),
    }),
    mergedContext: Annotation({ default: () => "" }),
    finalPlan: Annotation({ default: () => null }),
});

const agentLLM = createLLM({ temperature: 0.5, maxTokens: 400 });

/**
 * Runs one specialist agent: builds its prompt, calls the LLM, and parses
 * the result through the shared StructuredOutputParser (agentNoteSchema).
 * Retries once on transient failure; on total failure, degrades to a
 * clearly-marked placeholder instead of crashing the whole graph.
 */
async function runAgent(role, instructionText, state) {
    const formatInstructions = agentNoteParser.getFormatInstructions();
    const promptTemplate = ChatPromptTemplate.fromTemplate(buildAgentPrompt(role, instructionText));
    const chain = promptTemplate.pipe(agentLLM);

    try {
        const raw = await withRetry(
            () =>
                chain.invoke({
                    source: state.source,
                    destination: state.destination,
                    startDate: state.startDate,
                    endDate: state.endDate,
                    preferences: state.preferences,
                    toolResults: JSON.stringify(state.toolResults),
                    ragContext: state.ragContext,
                    format_instructions: formatInstructions,
                }),
            { retries: 1, label: `${role} agent` }
        );

        const text = typeof raw.content === "string" ? raw.content : String(raw.content);
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return await agentNoteParser.parse(cleaned);
    } catch (error) {
        logger.warn(`${role} agent failed, continuing with a placeholder note`, {
            error: error.message,
        });
        return { summary: `(${role} notes unavailable)`, keyPoints: [] };
    }
}

// ---- Planner (entry point, sequential) ----
async function plannerNode(state) {
    const note = await runAgent(
        "Planner Agent",
        "Give the overall trip framing: pace, vibe, and any date-driven constraints (trip length, season) the other agents should account for.",
        state
    );
    return { agentNotes: { planner: note } };
}

// ---- Parallel specialist agents ----
async function weatherNode(state) {
    let weatherData = "unavailable";
    try {
        weatherData = await weatherTool.func({ destination: state.destination });
    } catch (error) {
        logger.warn("weather tool invocation failed", { error: error.message });
    }
    const note = await runAgent(
        "Weather Agent",
        `Live weather data: ${weatherData}\nSummarize what it means for the trip and any weather-driven adjustments.`,
        state
    );
    return { toolResults: { weather: weatherData }, agentNotes: { weather: note } };
}

async function budgetNode(state) {
    const note = await runAgent(
        "Budget Agent",
        "Estimate a realistic relative budget split across travel, stay, food, and activities (describe proportions, not exact numbers).",
        state
    );
    return { agentNotes: { budget: note } };
}

async function transportNode(state) {
    let distanceData = "unavailable";
    try {
        distanceData = await distanceTool.func({ source: state.source, destination: state.destination });
    } catch (error) {
        logger.warn("distance tool invocation failed", { error: error.message });
    }
    const note = await runAgent(
        "Transport Agent",
        `Distance data: ${distanceData}\nRecommend realistic inter-city transport (to and return) and 2-3 local transport options.`,
        state
    );
    return { toolResults: { distance: distanceData }, agentNotes: { transport: note } };
}

async function hotelNode(state) {
    const note = await runAgent(
        "Hotel Agent",
        "Suggest what kind of accommodation fits this traveler's preferences and how it affects the stay budget.",
        state
    );
    return { agentNotes: { hotel: note } };
}

async function restaurantNode(state) {
    const note = await runAgent(
        "Restaurant Agent",
        "Suggest the type of dining experiences (not invented named restaurants) that fit this destination and traveler preferences.",
        state
    );
    return { agentNotes: { restaurant: note } };
}

async function safetyNode(state) {
    const note = await runAgent(
        "Safety Agent",
        "Call out destination-relevant safety and packing considerations from the retrieved knowledge worth weaving into the itinerary.",
        state
    );
    return { agentNotes: { safety: note } };
}

// ---- Merge: combine all parallel agent outputs into one context blob ----
async function mergeNode(state) {
    const merged = Object.entries(state.agentNotes)
        .map(([agent, note]) => `${agent}: ${note.summary} (${note.keyPoints.join("; ")})`)
        .join("\n");

    return { mergedContext: merged };
}

// ---- Generate Final Itinerary: the only node that produces the
//      frontend-facing JSON shape ----
async function generateItineraryNode(state) {
    const formatInstructions = travelPlanParser.getFormatInstructions();
    const chain = travelPlannerPrompt.pipe(createLLM({ temperature: 0.4, maxTokens: 1800 }));

    const raw = await withRetry(
        () =>
            chain.invoke({
                source: state.source,
                destination: state.destination,
                startDate: state.startDate,
                endDate: state.endDate,
                preferences: state.preferences,
                ragContext: state.ragContext,
                toolResults: JSON.stringify(state.toolResults),
                agentNotes: state.mergedContext,
                format_instructions: formatInstructions,
            }),
        { retries: 2, label: "final itinerary generation" }
    );

    const text = typeof raw.content === "string" ? raw.content : String(raw.content);
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
        parsed = await travelPlanParser.parse(cleaned);
    } catch (parseError) {
        // One repair attempt: ask the model to fix its own output against
        // the schema before giving up (Part 10: "validate outputs").
        logger.warn("Itinerary output failed schema validation, attempting repair", {
            error: parseError.message,
        });
        const repairLLM = createLLM({ temperature: 0, maxTokens: 1800 });
        const repaired = await repairLLM.invoke(
            `The following text should be valid JSON matching this schema but is not:\n\n${formatInstructions}\n\nBroken output:\n${cleaned}\n\nReturn ONLY the corrected JSON.`
        );
        const repairedText =
            typeof repaired.content === "string" ? repaired.content : String(repaired.content);
        const repairedCleaned = repairedText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = travelPlanSchema.parse(JSON.parse(repairedCleaned));
    }

    return { finalPlan: parsed };
}

// ============================================================
// Graph wiring
// ============================================================
const graph = new StateGraph(TravelState)
    .addNode("planner", plannerNode)
    .addNode("weather", weatherNode)
    .addNode("budget", budgetNode)
    .addNode("transport", transportNode)
    .addNode("hotel", hotelNode)
    .addNode("restaurant", restaurantNode)
    .addNode("safety", safetyNode)
    .addNode("merge", mergeNode)
    .addNode("generateItinerary", generateItineraryNode)
    .addEdge(START, "planner")
    // Fan-out: all six specialist agents run in the same superstep (parallel).
    .addEdge("planner", "weather")
    .addEdge("planner", "budget")
    .addEdge("planner", "transport")
    .addEdge("planner", "hotel")
    .addEdge("planner", "restaurant")
    .addEdge("planner", "safety")
    // Fan-in: merge only runs once every parallel agent above has finished.
    .addEdge("weather", "merge")
    .addEdge("budget", "merge")
    .addEdge("transport", "merge")
    .addEdge("hotel", "merge")
    .addEdge("restaurant", "merge")
    .addEdge("safety", "merge")
    .addEdge("merge", "generateItinerary")
    .addEdge("generateItinerary", END);

const compiledGraph = graph.compile();

/**
 * Runs the full multi-agent pipeline and returns a plan that already
 * matches the exact JSON shape TravelPlan.jsx expects.
 */
async function runTravelGraph({ source, destination, startDate, endDate, preferences }) {
    const ragContext = await retrieveContext(`${destination} travel guide safety packing`);

    const result = await compiledGraph.invoke({
        source,
        destination,
        startDate,
        endDate,
        preferences: preferences || "none known yet",
        ragContext,
    });

    return result.finalPlan;
}

module.exports = { runTravelGraph, compiledGraph };
// ============================================================
// Merge specialist-agent outputs
// ============================================================

async function mergeNode(state) {
    const notes = state.agentNotes || {};

    const merged = Object.entries(notes)
        .map(([agent, note]) => {
            if (!note || typeof note !== "object") {
                return `${agent}: No usable notes available.`;
            }

            const summary =
                typeof note.summary === "string"
                    ? note.summary
                    : "No summary available.";

            const keyPoints = Array.isArray(note.keyPoints)
                ? note.keyPoints
                : [];

            const pointsText =
                keyPoints.length > 0
                    ? keyPoints.join("; ")
                    : "No additional key points.";

            return `${agent}: ${summary} (${pointsText})`;
        })
        .join("\n");

    return {
        mergedContext:
            merged || "No specialist agent context is available.",
    };
}

// ============================================================
// Final itinerary generation
// ============================================================

async function generateItineraryNode(state) {
    const formatInstructions =
        travelPlanParser.getFormatInstructions();

    const finalLLM = createLLM({
        temperature: 0.4,
        maxTokens: 1800,
    });

    try {
        /*
         * travelPlannerPrompt should contain only static placeholders.
         *
         * IMPORTANT:
         * JSON/tool data is passed here as placeholder VALUES.
         * Never dynamically construct a ChatPromptTemplate containing
         * JSON strings because { } may be interpreted as template variables.
         */
        const chain = travelPlannerPrompt.pipe(finalLLM);

        const raw = await withRetry(
            () =>
                chain.invoke({
                    source: String(state.source || ""),
                    destination: String(
                        state.destination || ""
                    ),
                    startDate: String(
                        state.startDate || ""
                    ),
                    endDate: String(
                        state.endDate || ""
                    ),
                    preferences: String(
                        state.preferences ||
                            "none known yet"
                    ),

                    ragContext: String(
                        state.ragContext ||
                            "No additional retrieved travel knowledge available."
                    ),

                    toolResults: JSON.stringify(
                        state.toolResults || {},
                        null,
                        2
                    ),

                    agentNotes: String(
                        state.mergedContext ||
                            "No specialist agent notes available."
                    ),

                    format_instructions:
                        formatInstructions,
                }),
            {
                retries: 2,
                label: "final itinerary generation",
            }
        );

        const text =
            typeof raw.content === "string"
                ? raw.content
                : String(raw.content || "");

        const cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        if (!cleaned) {
            throw new Error(
                "Final itinerary generation returned an empty response"
            );
        }

        let parsed;

        try {
            // Primary structured-output parsing.
            parsed =
                await travelPlanParser.parse(cleaned);
        } catch (parseError) {
            logger.warn(
                "Itinerary output failed schema validation, attempting repair",
                {
                    error: parseError.message,
                }
            );

            /*
             * Repair is deliberately performed using a direct LLM call,
             * not ChatPromptTemplate.fromTemplate().
             *
             * formatInstructions and cleaned output may contain JSON braces.
             * Passing them directly to the model avoids LangChain treating
             * those braces as template variables.
             */
            const repairLLM = createLLM({
                temperature: 0,
                maxTokens: 1800,
            });

            const repairPrompt = [
                "You are a JSON repair assistant.",
                "",
                "The following AI-generated travel plan must be converted into valid JSON.",
                "",
                "The JSON must satisfy these structured-output requirements:",
                "",
                formatInstructions,
                "",
                "Broken output:",
                "",
                cleaned,
                "",
                "Rules:",
                "1. Return ONLY valid JSON.",
                "2. Do not use Markdown.",
                "3. Do not include ```json code fences.",
                "4. Do not include explanations.",
                "5. Preserve useful information from the original output.",
                "6. Ensure all required fields are present.",
                "7. Ensure numeric budget and transport cost fields are numbers.",
            ].join("\n");

            const repaired =
                await repairLLM.invoke(repairPrompt);

            const repairedText =
                typeof repaired.content === "string"
                    ? repaired.content
                    : String(
                          repaired.content || ""
                      );

            const repairedCleaned =
                repairedText
                    .replace(/```json/gi, "")
                    .replace(/```/g, "")
                    .trim();

            if (!repairedCleaned) {
                throw new Error(
                    "Itinerary repair returned an empty response"
                );
            }

            let repairedJSON;

            try {
                repairedJSON =
                    JSON.parse(repairedCleaned);
            } catch (jsonError) {
                logger.error(
                    "Repaired itinerary is still invalid JSON",
                    {
                        error: jsonError.message,
                    }
                );

                throw new Error(
                    "AI generated an invalid travel plan response"
                );
            }

            // Final Zod validation.
            parsed =
                travelPlanSchema.parse(
                    repairedJSON
                );
        }

        return {
            finalPlan: parsed,
        };
    } catch (error) {
        logger.error(
            "Final itinerary generation failed",
            {
                error: error.message,
                destination:
                    state.destination,
            }
        );

        throw error;
    }
}

// ============================================================
// LangGraph workflow wiring
// ============================================================

const graph = new StateGraph(TravelState)
    .addNode(
        "planner",
        plannerNode
    )
    .addNode(
        "weather",
        weatherNode
    )
    .addNode(
        "budget",
        budgetNode
    )
    .addNode(
        "transport",
        transportNode
    )
    .addNode(
        "hotel",
        hotelNode
    )
    .addNode(
        "restaurant",
        restaurantNode
    )
    .addNode(
        "safety",
        safetyNode
    )
    .addNode(
        "merge",
        mergeNode
    )
    .addNode(
        "generateItinerary",
        generateItineraryNode
    )

    // Entry point
    .addEdge(
        START,
        "planner"
    )

    // ========================================================
    // Fan-out
    // ========================================================

    .addEdge(
        "planner",
        "weather"
    )
    .addEdge(
        "planner",
        "budget"
    )
    .addEdge(
        "planner",
        "transport"
    )
    .addEdge(
        "planner",
        "hotel"
    )
    .addEdge(
        "planner",
        "restaurant"
    )
    .addEdge(
        "planner",
        "safety"
    )

    // ========================================================
    // Fan-in
    // ========================================================

    .addEdge(
        "weather",
        "merge"
    )
    .addEdge(
        "budget",
        "merge"
    )
    .addEdge(
        "transport",
        "merge"
    )
    .addEdge(
        "hotel",
        "merge"
    )
    .addEdge(
        "restaurant",
        "merge"
    )
    .addEdge(
        "safety",
        "merge"
    )

    // Final structured itinerary
    .addEdge(
        "merge",
        "generateItinerary"
    )

    .addEdge(
        "generateItinerary",
        END
    );

const compiledGraph =
    graph.compile();

// ============================================================
// Public graph runner
// ============================================================

/**
 * Runs the complete AI travel-planning pipeline.
 *
 * Flow:
 *
 * Input
 *   ↓
 * RAG retrieval
 *   ↓
 * Planner
 *   ↓
 * Parallel specialist agents
 *   ↓
 * Merge
 *   ↓
 * Structured itinerary generation
 *   ↓
 * Zod validation
 *   ↓
 * TravelPlan-compatible JSON
 */
async function runTravelGraph({
    source,
    destination,
    startDate,
    endDate,
    preferences,
}) {
    if (!source) {
        throw new Error(
            "Trip source is required"
        );
    }

    if (!destination) {
        throw new Error(
            "Trip destination is required"
        );
    }

    if (!startDate) {
        throw new Error(
            "Trip start date is required"
        );
    }

    if (!endDate) {
        throw new Error(
            "Trip end date is required"
        );
    }

    // ========================================================
    // RAG retrieval
    // ========================================================

    let ragContext =
        "No additional retrieved travel knowledge available.";

    try {
        ragContext =
            await retrieveContext(
                [
                    destination,
                    "travel guide",
                    "local safety",
                    "weather",
                    "packing",
                    "transport",
                    "culture",
                ].join(" ")
            );
    } catch (error) {
        /*
         * RAG is an enhancement, not a hard dependency.
         *
         * If ChromaDB is unavailable, trip generation should continue
         * through the LangGraph workflow without retrieved context.
         */
        logger.warn(
            "RAG retrieval unavailable; continuing without retrieved context",
            {
                error: error.message,
                destination,
            }
        );
    }

    // ========================================================
    // Execute LangGraph
    // ========================================================

    const result =
        await compiledGraph.invoke({
            source,
            destination,
            startDate,
            endDate,

            preferences:
                preferences ||
                "none known yet",

            ragContext,

            toolResults: {},

            agentNotes: {},
        });

    // ========================================================
    // Defensive output validation
    // ========================================================

    if (!result) {
        throw new Error(
            "Travel graph returned no result"
        );
    }

    if (!result.finalPlan) {
        throw new Error(
            "Travel graph completed without generating a final itinerary"
        );
    }

    /*
     * Validate once more before returning data to the controller.
     * This protects TravelPlan.jsx from receiving missing arrays/objects
     * that could cause `.map()` runtime errors.
     */
    const validatedPlan =
        travelPlanSchema.parse(
            result.finalPlan
        );

    return validatedPlan;
}

module.exports = {
    runTravelGraph,
    compiledGraph,
};