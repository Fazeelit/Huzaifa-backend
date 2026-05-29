const uploadYouTubeVideo = (field = "videoFile") => {
  return (req, res, next) => {
    if (!req.body) req.body = {};

    // Accept multiple possible field names
    const url =
      req.body[field] || req.body.videoFile || req.body.video || req.body.url;

    if (!url) {
      return res.status(400).json({ message: "YouTube link is required" });
    }

    const regex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;

    if (!regex.test(url)) {
      return res.status(400).json({ message: "Invalid YouTube URL" });
    }

    req.videoUrl = url.trim();
    next();
  };
};

export default uploadYouTubeVideo;