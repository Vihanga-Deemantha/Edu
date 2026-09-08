import { useReducedMotion } from "../hooks/useReducedMotion.js";

const HeroVideo = () => {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <img
        src="/Gemini_Generated_Image_bgttmebgttmebgtt.jpg"
        alt="EduLink — connecting students and teachers"
        className="hero-poster-fallback w-full h-full"
        style={{ display: "block", objectFit: "cover", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />
    );
  }

  return (
    <video
      className="hero-video-el w-full h-full"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster="/Gemini_Generated_Image_bgttmebgttmebgtt.jpg"
      aria-hidden="true"
      style={{ objectFit: "cover", width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 0 }}
    >
      <source src="/whatsapp-video.mp4" type="video/mp4" />
      <img
        src="/Gemini_Generated_Image_bgttmebgttmebgtt.jpg"
        alt="EduLink — connecting students and teachers"
      />
    </video>
  );
};

export default HeroVideo;
