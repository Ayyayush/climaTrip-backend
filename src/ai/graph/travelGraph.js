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
