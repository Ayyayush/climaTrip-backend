const { z } = require("zod");
const { StructuredOutputParser } = require("langchain/output_parsers");

// This shape is load-bearing: TravelPlan.jsx reads exactly these fields
// (transport_options.to_destination/return, local_transport, nature_spots,
// tourist_spots, day_wise_itinerary[].date/activities, budget_breakdown,
// return_plan). Changing field names here would break the existing UI,
// so this schema intentionally mirrors the original hand-written prompt's
// JSON shape field-for-field instead of "improving" it.
const transportLegSchema = z.object({
    mode: z.string(),
    estimated_time: z.string(),
    cost: z.number(),
});

const travelPlanSchema = z.object({
    transport_options: z.object({
        to_destination: transportLegSchema,
        return: transportLegSchema,
    }),
    local_transport: z.array(z.string()),
    nature_spots: z.array(z.string()),
    tourist_spots: z.array(z.string()),
    day_wise_itinerary: z.array(
        z.object({
            date: z.string(),
            activities: z.array(z.string()),
        })
    ),
    budget_breakdown: z.object({
        travel: z.number(),
        stay: z.number(),
        food: z.number(),
        activities: z.number(),
        total: z.number(),
    }),
    return_plan: z.object({
        time: z.string(),
        mode: z.string(),
    }),
});

const travelPlanParser = StructuredOutputParser.fromZodSchema(travelPlanSchema);

const agentNoteSchema = z.object({
    summary: z.string().describe("2-4 sentence summary of this agent's findings/recommendation"),
    keyPoints: z.array(z.string()).describe("2-4 short bullet-style key points"),
});

const agentNoteParser = StructuredOutputParser.fromZodSchema(agentNoteSchema);

module.exports = { travelPlanSchema, travelPlanParser, agentNoteSchema, agentNoteParser };
