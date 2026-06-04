const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
    try
    {
        const token = req.header("Authorization");

        if(!token)
        {
            return res.status(401).json({
                success:false,
                message:"No token found"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        next();
    }
    catch(error)
    {
        return res.status(401).json({
            success:false,
            message:"Invalid Token"
        });
    }
};

module.exports = authMiddleware;