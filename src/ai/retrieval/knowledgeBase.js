// Seed knowledge for RAG (Part 7). In production, replace/extend this
// with a real content pipeline (CMS export, curated docs, etc) — this
// file exists so the retriever has something meaningful to index
// out of the box and so the seeding script is reproducible.
const knowledgeDocuments = [
    {
        category: "packing",
        text:
            "General beach trip packing guide: reef-safe sunscreen (SPF 30+), " +
            "lightweight quick-dry clothing, a wide-brim hat, polarized sunglasses, " +
            "a dry bag for electronics, flip-flops plus one pair of closed shoes for " +
            "excursions, and a refillable water bottle.",
    },
    {
        category: "packing",
        text:
            "General mountain/cold-weather trip packing guide: layered clothing " +
            "(base, insulating, waterproof shell), sturdy broken-in hiking boots, " +
            "gloves and a warm hat, a headlamp, and blister plasters.",
    },
    {
        category: "beach-safety",
        text:
            "Beach safety fundamentals: always swim near a lifeguard station, check " +
            "flag warnings before entering the water, be aware of rip currents (swim " +
            "parallel to shore to escape one, never fight directly against it), and " +
            "avoid swimming alone or immediately after heavy rain due to runoff.",
    },
    {
        category: "beach-safety",
        text:
            "Sun safety: peak UV hours are typically 10am-4pm; reapply sunscreen every " +
            "2 hours and after swimming; heat exhaustion warning signs include heavy " +
            "sweating, dizziness, and nausea — move to shade and hydrate immediately.",
    },
    {
        category: "emergency",
        text:
            "General emergency preparedness for international travel: save the local " +
            "emergency number, register with your embassy's traveler program if " +
            "available, keep a photo of your passport and insurance card separate " +
            "from the originals, and know the address/phone of the nearest hospital " +
            "to your accommodation.",
    },
    {
        category: "budget",
        text:
            "Budget travel tips: booking transport and accommodation 4-8 weeks ahead " +
            "typically gets better rates; local buses/trains are usually far cheaper " +
            "than taxis for city-to-city travel; street food and local markets stretch " +
            "a food budget much further than tourist-area restaurants.",
    },
    {
        category: "transport",
        text:
            "Choosing local transport: for short intra-city trips, ride-hailing apps or " +
            "metro/bus systems are usually fastest and cheapest; for day trips to " +
            "nearby attractions, a shared shuttle or rental scooter/bike is often more " +
            "economical than a private taxi for a full day.",
    },
    {
        category: "nightlife",
        text:
            "Nightlife safety: keep track of your drink, travel in groups late at night, " +
            "confirm the last public transport time back to your accommodation before " +
            "heading out, and keep a card with your hotel's address on you.",
    },
];

module.exports = { knowledgeDocuments };
