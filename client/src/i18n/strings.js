/**
 * UI-chrome translations — the header, footer and account menus that appear
 * on every page, regardless of which one you're on. Keyed by the English
 * text itself (not an abstract key name) so a missing translation always
 * falls back to readable English instead of a raw key like "nav.home".
 *
 * Deliberately NOT a full-site translation yet — marketing copy on the
 * landing page (hero headlines, trust sections, how-it-works, testimonials)
 * and the content of individual dashboard/form pages still need their own
 * pass; see frontend-polish-backlog.md's "Full UI localization" item. This
 * covers the chrome that's visible from literally everywhere, so switching
 * language has an immediate, real effect no matter what page you're on.
 */
export const UI_STRINGS = {
  "Home": { si: "මුල් පිටුව", ta: "முகப்பு" },
  "Browse": { si: "සොයන්න", ta: "உலாவு" },
  "Explore": { si: "සොයන්න", ta: "ஆராயுங்கள்" },
  "Explore classes": { si: "පන්ති සොයන්න", ta: "வகுப்புகளை ஆராயுங்கள்" },
  "Interests": { si: "කැමැත්ත", ta: "ஆர்வங்கள்" },
  "Chat": { si: "කතාබස්", ta: "அரட்டை" },
  "Bookings": { si: "වෙන්කිරීම්", ta: "முன்பதிவுகள்" },
  "Children": { si: "දරුවන්", ta: "குழந்தைகள்" },
  "Dashboard": { si: "උපකරණ පුවරුව", ta: "டாஷ்போர்டு" },
  "Go to dashboard": { si: "උපකරණ පුවරුවට යන්න", ta: "டாஷ்போர்டுக்குச் செல்" },
  "My listings": { si: "මගේ දැන්වීම්", ta: "எனது விளம்பரங்கள்" },
  "Availability": { si: "ලබාගත හැකි වේලා", ta: "கிடைக்கும் நேரம்" },
  "Admin console": { si: "පරිපාලක පුවරුව", ta: "நிர்வாகக் கட்டுப்பாடு" },
  "For teachers": { si: "ගුරුවරුන් සඳහා", ta: "ஆசிரியர்களுக்கு" },
  "For parents": { si: "දෙමාපියන් සඳහා", ta: "பெற்றோர்களுக்கு" },
  "My profile": { si: "මගේ පැතිකඩ", ta: "எனது சுயவிவரம்" },
  "My wanted ads": { si: "මගේ අවශ්‍යතා දැන්වීම්", ta: "எனது தேவை விளம்பரங்கள்" },
  "Notifications": { si: "දැනුම්දීම්", ta: "அறிவிப்புகள்" },
  "My children": { si: "මගේ දරුවන්", ta: "எனது குழந்தைகள்" },
  "Children's profiles": { si: "දරුවන්ගේ පැතිකඩ", ta: "குழந்தைகளின் சுயவிவரங்கள்" },
  "Wanted ads": { si: "අවශ්‍යතා දැන්වීම්", ta: "தேவை விளம்பரங்கள்" },
  "Public profile": { si: "පොදු පැතිකඩ", ta: "பொது சுயவிவரம்" },
  "Edit profile": { si: "පැතිකඩ සංස්කරණය", ta: "சுயவிவரத்தைத் திருத்து" },
  "Verification": { si: "තහවුරු කිරීම", ta: "சரிபார்ப்பு" },
  "How verification works": { si: "තහවුරු කිරීම ක්‍රියා කරන ආකාරය", ta: "சரிபார்ப்பு எவ்வாறு செயல்படுகிறது" },
  "Sign in": { si: "පුරන්න", ta: "உள்நுழைக" },
  "Join for free": { si: "නොමිලේ එකතු වන්න", ta: "இலவசமாகச் சேரவும்" },
  "Join": { si: "එකතු වන්න", ta: "சேரவும்" },
  "Log out": { si: "ඉවත් වන්න", ta: "வெளியேறு" },
  "What do you want to learn?": { si: "ඔබට ඉගෙන ගැනීමට අවශ්‍ය කුමක්ද?", ta: "நீங்கள் என்ன கற்க விரும்புகிறீர்கள்?" },
  "Teach": { si: "උගන්වන්න", ta: "கற்பிக்க" },
  "Become a teacher": { si: "ගුරුවරයෙකු වන්න", ta: "ஆசிரியராக மாறுங்கள்" },
  "Post a class ad": { si: "පන්ති දැන්වීමක් පළ කරන්න", ta: "வகுப்பு விளம்பரத்தை இடுகையிடவும்" },
  "Browse teachers": { si: "ගුරුවරුන් සොයන්න", ta: "ஆசிரியர்களை உலாவு" },
  "Subjects": { si: "විෂයයන්", ta: "பாடங்கள்" },
  "Report a problem": { si: "ගැටලුවක් වාර්තා කරන්න", ta: "சிக்கலைப் புகாரளிக்கவும்" },
  "Contact": { si: "සම්බන්ධ වන්න", ta: "தொடர்பு" },
  "LEARN": { si: "ඉගෙනීම", ta: "கற்றல்" },
  "TEACH": { si: "ඉගැන්වීම", ta: "கற்பித்தல்" },
  "All rights reserved.": { si: "සියලු හිමිකම් ඇවිරිණි.", ta: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை." },
  "Verified teachers for every learner in Sri Lanka.": {
    si: "ශ්‍රී ලංකාවේ සෑම ඉගෙනුම්කරුවෙකු සඳහාම තහවුරු කළ ගුරුවරු.",
    ta: "இலங்கையில் ஒவ்வொரு கற்பவருக்கும் சரிபார்க்கப்பட்ட ஆசிரியர்கள்.",
  },
};
