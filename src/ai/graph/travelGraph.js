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
// Multi-agent workflow
//
//                         START
//                           |
//                        Planner
//                           |
//        -----------------------------------------------
//        |         |          |        |        |        |
//     Weather   Budget    Transport   Hotel  Restaurant Safety
//        |         |          |        |        |        |
//        -----------------------------------------------
//                           |
//                         Merge
//                           |
//                  Generate Final Itinerary
//                           |
//                          END
// ============================================================

const TravelState = Annotation.Root({
    source: Annotation(),
    destination: Annotation(),
    startDate: Annotation(),
    endDate: Annotation(),

    preferences: Annotation({
        default: () => "none known yet",
    }),

    ragContext: Annotation({
        default: () => "",
    }),

    toolResults: Annotation({
        default: () => ({}),
        reducer: (existing, update) => ({
            ...(existing || {}),
            ...(update || {}),
        }),
    }),

    agentNotes: Annotation({
        default: () => ({}),
        reducer: (existing, update) => ({
            ...(existing || {}),
            ...(update || {}),
        }),
    }),

    mergedContext: Annotation({
        default: () => "",
    }),

    finalPlan: Annotation({
        default: () => null,
    }),
});

const agentLLM = createLLM({
    temperature: 0.5,
    maxTokens: 400,
});

/**
 * Runs one specialist agent.
 *
 * IMPORTANT:
 * Dynamic data such as tool results and RAG context must NOT be inserted
 * directly into ChatPromptTemplate.fromTemplate().
 *
 * Tool results may contain JSON with { } characters. LangChain interprets
 * those braces as template variables, causing errors such as:
 *
 * - Single '}' in template
 * - Missing value for input variable `"distanceKm":...`
 *
 * Therefore, the prompt template is created only from static placeholders.
 * Dynamic values are supplied later through chain.invoke().
 */
async function runAgent(role, instructionText, state) {
    const formatInstructions = agentNoteParser.getFormatInstructions();

    // Build a SAFE static prompt.
    // Never interpolate JSON/tool data directly into fromTemplate().
    const promptTemplate = ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are a specialist travel-planning agent.

Your role is:
{role}

Your task is:
{instruction}

Analyze the provided trip information carefully.

Return your answer using exactly the required structured-output format.

{format_instructions}`,
        ],
        [
            "human",
            `Trip details:

Source:
{source}

Destination:
{destination}

Start date:
{startDate}

End date:
{endDate}

Traveler preferences:
{preferences}

Available tool results:
{toolResults}

Retrieved travel knowledge:
{ragContext}`,
        ],
    ]);

    const chain = promptTemplate.pipe(agentLLM);

    try {
        const raw = await withRetry(
            () =>
                chain.invoke({
                    role: String(role || "Travel Specialist"),
                    instruction: String(
                        instructionText || "Analyze the trip and provide relevant recommendations."
                    ),
                    source: String(state.source || ""),
                    destination: String(state.destination || ""),
                    startDate: String(state.startDate || ""),
                    endDate: String(state.endDate || ""),
                    preferences: String(state.preferences || "none known yet"),

                    // JSON is passed as a VALUE rather than compiled into
                    // the template. Curly braces are therefore safe.
                    toolResults: JSON.stringify(state.toolResults || {}, null, 2),

                    ragContext: String(
                        state.ragContext ||
                            "No additional retrieved knowledge is currently available."
                    ),

                    format_instructions: formatInstructions,
                }),
            {
                retries: 1,
                label: `${role} agent`,
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
            throw new Error(`${role} returned an empty response`);
        }

        return await agentNoteParser.parse(cleaned);
    } catch (error) {
        logger.warn(
            `${role} agent failed, continuing with a placeholder note`,
            {
                error: error.message,
            }
        );

        return {
            summary: `(${role} notes unavailable)`,
            keyPoints: [],
        };
    }
}

// ============================================================
// Planner
// ============================================================

async function plannerNode(state) {
    const note = await runAgent(
        "Planner Agent",
        "Give the overall trip framing: pace, vibe, and any date-driven constraints such as trip length and season that the other agents should account for.",
        state
    );

    return {
        agentNotes: {
            planner: note,
        },
    };
}

// ============================================================
// Parallel specialist agents
// ============================================================

async function weatherNode(state) {
    let weatherData = "unavailable";

    try {
        const result = await weatherTool.func({
            destination: state.destination,
        });

        weatherData =
            typeof result === "string"
                ? result
                : JSON.stringify(result || {});
    } catch (error) {
        logger.warn("Weather tool invocation failed", {
            error: error.message,
        });
    }

    // Do NOT inject weatherData directly into instructionText.
    // Keep dynamic tool data in state.toolResults.
    const agentState = {
        ...state,
        toolResults: {
            ...(state.toolResults || {}),
            weather: weatherData,
        },
    };

    const note = await runAgent(
        "Weather Agent",
        "Analyze the available weather information and summarize what it means for the trip, including any weather-driven itinerary or packing adjustments.",
        agentState
    );

    return {
        toolResults: {
            weather: weatherData,
        },
        agentNotes: {
            weather: note,
        },
    };
}

async function budgetNode(state) {
    const note = await runAgent(
        "Budget Agent",
        "Estimate a realistic relative budget split across travel, stay, food, and activities. Describe sensible proportions and budget considerations rather than inventing unsupported exact prices.",
        state
    );

    return {
        agentNotes: {
            budget: note,
        },
    };
}

async function transportNode(state) {
    let distanceData = "unavailable";

    try {
        const result = await distanceTool.func({
            source: state.source,
            destination: state.destination,
        });

        distanceData =
            typeof result === "string"
                ? result
                : JSON.stringify(result || {});
    } catch (error) {
        logger.warn("Distance tool invocation failed", {
            error: error.message,
        });
    }

    // Keep JSON/dynamic distance data out of the prompt template itself.
    const agentState = {
        ...state,
        toolResults: {
            ...(state.toolResults || {}),
            distance: distanceData,
        },
    };

    const note = await runAgent(
        "Transport Agent",
        "Using the available distance information, recommend realistic inter-city transport for the outbound and return journeys, plus 2-3 appropriate local transport options.",
        agentState
    );

    return {
        toolResults: {
            distance: distanceData,
        },
        agentNotes: {
            transport: note,
        },
    };
}

async function hotelNode(state) {
    const note = await runAgent(
        "Hotel Agent",
        "Suggest what type of accommodation best fits the traveler's destination and preferences, and explain how accommodation choice affects the overall stay budget.",
        state
    );

    return {
        agentNotes: {
            hotel: note,
        },
    };
}

async function restaurantNode(state) {
    const note = await runAgent(
        "Restaurant Agent",
        "Suggest appropriate types of dining experiences for this destination and traveler preferences. Do not invent specific restaurant names unless supported by retrieved context.",
        state
    );

    return {
        agentNotes: {
            restaurant: note,
        },
    };
}

async function safetyNode(state) {
    const note = await runAgent(
        "Safety Agent",
        "Identify destination-relevant safety, weather, health, cultural, and packing considerations supported by the available retrieved knowledge. Avoid inventing unsupported safety claims.",
        state
    );

    return {
        agentNotes: {
            safety: note,
        },
    };
}
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