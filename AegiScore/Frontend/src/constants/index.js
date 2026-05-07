import {
  benefitIcon1,
  benefitIcon2,
  benefitIcon3,
  benefitIcon4,
  benefitImage2,
  chromecast,
  disc02,
  discord,
  discordBlack,
  facebook,
  figma,
  file02,
  framer,
  homeSmile,
  instagram,
  notification2,
  notification3,
  notification4,
  notion,
  photoshop,
  plusSquare,
  protopie,
  raindrop,
  recording01,
  recording03,
  roadmap1,
  roadmap2,
  roadmap3,
  roadmap4,
  searchMd,
  slack,
  sliders04,
  telegram,
  twitter,
  yourlogo,
} from "../assets";

export const navigation = [
  { id: "0", title: "Features", url: "/#features" },
];

export const heroIcons = [homeSmile, file02, searchMd, plusSquare];

export const notificationImages = [notification4, notification3, notification2];

export const companyLogos = [yourlogo, yourlogo, yourlogo, yourlogo, yourlogo];

export const brainwaveServicesIcons = [
  recording03, recording01, disc02, chromecast, sliders04,
];

export const benefits = [
  {
    id: "0",
    title: "Real-time SOC Dashboard",
    text: "Monitor threats in real-time with WebSocket-powered alerts and live event feeds.",
    backgroundUrl: "./src/assets/benefits/card-1.svg",
    iconUrl: benefitIcon2,
    imageUrl: benefitImage2,
    linkUrl: "/soc",
  },
  {
    id: "1",
    title: "AI Threat Detection",
    text: "LSTM neural network trained on cybersecurity data to detect anomalies and classify attack categories.",
    backgroundUrl: "./src/assets/benefits/card-2.svg",
    iconUrl: benefitIcon1,
    imageUrl: benefitImage2,
    light: true,
    linkUrl: "/dashboard",
  },
  {
    id: "2",
    title: "Log Management",
    text: "Upload, generate, and inspect system logs with automatic ingestion and indexing.",
    backgroundUrl: "./src/assets/benefits/card-3.svg",
    iconUrl: benefitIcon3,
    imageUrl: benefitImage2,
    linkUrl: "/logs",
  },
  {
    id: "3",
    title: "AI Audit Reports",
    text: "Generate comprehensive cybersecurity audit reports powered by Gemini AI.",
    backgroundUrl: "./src/assets/benefits/card-4.svg",
    iconUrl: benefitIcon4,
    imageUrl: benefitImage2,
    light: true,
    linkUrl: "/audit",
  },
  {
    id: "4",
    title: "NLP Chat Monitoring",
    text: "Detect prompt injection, social engineering, reconnaissance, and impersonation in real-time.",
    backgroundUrl: "./src/assets/benefits/card-5.svg",
    iconUrl: benefitIcon2,
    imageUrl: benefitImage2,
    linkUrl: "/soc",
  },
  {
    id: "5",
    title: "Role-Based Access",
    text: "Enterprise RBAC with Admin, Analyst, and Viewer roles secured by JWT authentication.",
    backgroundUrl: "./src/assets/benefits/card-6.svg",
    iconUrl: benefitIcon3,
    imageUrl: benefitImage2,
    light: true,
    linkUrl: "/login",
  },
];

export const socials = [
  { id: "0", title: "Instagram", iconUrl: instagram, url: "#" },
  { id: "1", title: "Telegram", iconUrl: telegram, url: "#" },
  { id: "2", title: "Facebook", iconUrl: facebook, url: "#" },
];
