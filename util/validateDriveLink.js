const validateDriveLink = (req, res, next) => {
  const { driveLink } = req.body;

  if (!driveLink) {
    return res.status(400).json({
      success: false,
      message: "Google Drive link is required",
    });
  }

  // Optional: basic URL validation
  if (!driveLink.startsWith("https://drive.google.com/")) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid Google Drive link",
    });
  }

  next();
};

export default validateDriveLink;
