/**
 * express-mongo-sanitize and xss-clean both try to reassign req.query,
 * which is a read-only getter in Express 5 and throws at runtime.
 * This does the same two jobs (strip Mongo operator keys, escape
 * obvious script/HTML injection) by mutating objects in place instead
 * of reassigning req.query/req.params, so it's safe on Express 5.
 */

const MONGO_OPERATOR_KEY = /^\$/;
const DOTTED_KEY = /\./;

function stripMongoOperators(input) {
    if (Array.isArray(input)) {
        input.forEach(stripMongoOperators);
        return input;
    }

    if (input && typeof input === "object") {
        for (const key of Object.keys(input)) {
            if (MONGO_OPERATOR_KEY.test(key) || DOTTED_KEY.test(key)) {
                delete input[key];
                continue;
            }
            stripMongoOperators(input[key]);
        }
    }

    return input;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

// Fields intentionally excluded from HTML-escaping: escaping a password
// (or anything hashed/compared byte-for-byte) would silently change what
// gets hashed vs what the user typed. These are never rendered as HTML,
// so there's nothing to protect here.
const NO_ESCAPE_FIELDS = new Set(["password", "confirmPassword", "token"]);

function escapeStrings(input) {
    if (Array.isArray(input)) {
        return input.map(escapeStrings);
    }

    if (input && typeof input === "object") {
        for (const key of Object.keys(input)) {
            const value = input[key];
            if (NO_ESCAPE_FIELDS.has(key)) {
                continue;
            }
            if (typeof value === "string") {
                input[key] = escapeHtml(value);
            } else {
                escapeStrings(value);
            }
        }
        return input;
    }

    return input;
}

const sanitizeInput = (req, res, next) => {
    // req.body is a plain writable object -> safe to mutate directly.
    if (req.body && typeof req.body === "object") {
        stripMongoOperators(req.body);
        escapeStrings(req.body);
    }

    // req.query / req.params are getters in Express 5: mutate keys in place,
    // never reassign req.query = ... / req.params = ...
    if (req.query && typeof req.query === "object") {
        stripMongoOperators(req.query);
    }
    if (req.params && typeof req.params === "object") {
        stripMongoOperators(req.params);
    }

    next();
};

module.exports = sanitizeInput;
