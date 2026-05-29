import mongoose from "mongoose";

const validateId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id?.trim())) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  next();
};

export default validateId;
