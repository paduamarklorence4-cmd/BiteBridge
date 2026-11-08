"""BiteBridge AI service.

Run from the ai/ folder:
    py ai_service.py
Endpoints:
    GET  /health
    POST /chat   body: {"message": "..."}
The model only picks an intent. Replies are fixed, pre-written texts, so the bot
never invents medical advice. All first aid wording must be approved by the
center's nurse or physician before real use.
Replies come in English and Filipino; Filipino/Taglish messages get Filipino replies.
"""
import re

import joblib
from flask import Flask, jsonify, request

CONFIDENCE_THRESHOLD = 0.40

# Update these to the center's verified details.
PHONE = "0948 983 8158"
ADDRESS = "C5 Road, Barangay Sapul, Calapan City"
HOURS_EN = "Monday to Saturday, 8:00 AM to 5:00 PM, and Sunday, 8:00 AM to 12:00 NN"
HOURS_FIL = "Lunes hanggang Sabado, 8:00 AM hanggang 5:00 PM, at Linggo, 8:00 AM hanggang 12:00 NN"

FIRST_AID_EN = (
    "1. Wash the wound well with soap and running water for at least 15 minutes.\n"
    "2. Cover it with a clean cloth or dressing.\n"
    "3. Go to EZ Animal Bite Center as soon as possible for assessment, even if the wound looks small."
)
FIRST_AID_FIL = (
    "1. Hugasan nang mabuti ang sugat gamit ang sabon at umaagos na tubig nang hindi bababa sa 15 minuto.\n"
    "2. Takpan ng malinis na tela o benda.\n"
    "3. Pumunta agad sa EZ Animal Bite Center para masuri, kahit maliit lang ang sugat."
)

REPLIES = {
    "en": {
        "greeting": "Hello! Welcome to EZ Animal Bite Center. I can help with clinic hours, location, services, fees, vaccine schedules, and basic first aid. What would you like to know?",
        "bite_report": f"I'm sorry that happened. Please act right away:\n{FIRST_AID_EN}\n\nCall {PHONE} or visit us at {ADDRESS}. This is basic first aid only and does not replace an assessment by our nurse or physician.",
        "first_aid": f"Here are the basic first aid steps for an animal bite:\n{FIRST_AID_EN}\n\nThis is general information and does not replace a medical assessment.",
        "hours": f"We're open {HOURS_EN}. For holiday schedules or changes, please call {PHONE}.",
        "location": f"We're at {ADDRESS}. Tap Get Directions on our website to open the map.",
        "contact": f"You can call us at {PHONE} during operating hours.",
        "services": "Here's what we offer:\n- Animal bite assessment\n- Rabies vaccination\n- Treatment and vaccination records\n- Vaccination follow-up\n- First aid guidance\n- Appointment scheduling",
        "vaccine_followup": f"Your nurse or physician sets your dose schedule. If you missed a dose or aren't sure of your next date, please call {PHONE} so our staff can check your record.",
        "appointment": f"We accept both walk-ins and booked appointments. To book or ask about a schedule, please call {PHONE}.",
        "fees": f"Payments are made at the center by cash, GCash, or Maya. For the exact amount, please call {PHONE}.",
        "thanks": "You're welcome! Take care, and feel free to ask if you need anything else.",
        "medical_advice": f"I'm sorry, I can't diagnose, recommend medicine, or give dosages. Please talk to our nurse or physician at the center, or call {PHONE}.",
        "off_topic": "I can only help with questions about EZ Animal Bite Center, such as hours, location, services, fees, and basic first aid.",
        "about_system": f"Sorry, I don't have information about that. I can only help with questions about the clinic. For anything else, please call {PHONE}.",
        "staff_info": f"For questions about our staff or who is on duty, please contact the center at {PHONE} during operating hours.",
        "bot_identity": "I'm the virtual assistant of EZ Animal Bite Center, not a person. I can answer basic questions about the clinic and share basic first aid information, but I can't give medical advice.",
        "unknown": f"I'm not sure I understood that. I can help with hours, location, contact details, services, fees, and first aid. For anything else, please call {PHONE}.",
    },
    "fil": {
        "greeting": "Kumusta po! Welcome sa EZ Animal Bite Center. Matutulungan ko po kayo sa oras ng clinic, lokasyon, serbisyo, bayad, schedule ng bakuna, at first aid. Ano po ang maitutulong ko?",
        "bite_report": f"Pasensya na po sa nangyari. Gawin po agad ito:\n{FIRST_AID_FIL}\n\nTumawag sa {PHONE} o pumunta sa {ADDRESS}. Pangunahing first aid lamang po ito at hindi kapalit ng pagsusuri ng aming nurse o doktor.",
        "first_aid": f"Narito po ang pangunahing first aid sa kagat ng hayop:\n{FIRST_AID_FIL}\n\nPangkalahatang impormasyon lamang po ito at hindi kapalit ng pagsusuring medikal.",
        "hours": f"Bukas po kami {HOURS_FIL}. Para sa schedule tuwing holiday o kung may pagbabago, tumawag po sa {PHONE}.",
        "location": f"Nasa {ADDRESS} po kami. Pindutin ang Get Directions sa website para makita ang mapa.",
        "contact": f"Maaari po kayong tumawag sa {PHONE} sa oras ng clinic.",
        "services": "Narito po ang mga serbisyo namin:\n- Pagsusuri sa kagat ng hayop\n- Bakuna laban sa rabies\n- Talaan ng gamutan at bakuna\n- Follow-up ng bakuna\n- Gabay sa first aid\n- Pag-iskedyul ng appointment",
        "vaccine_followup": f"Ang nurse o doktor po ang nagtatakda ng schedule ng inyong bakuna. Kung nakalimutan ninyo ang isang turok o hindi sigurado sa susunod na petsa, tumawag po sa {PHONE} para matingnan ng staff ang inyong record.",
        "appointment": f"Tumatanggap po kami ng walk-in at may appointment. Para mag-book o magtanong ng schedule, tumawag po sa {PHONE}.",
        "fees": f"Sa center po ang bayad, sa cash, GCash, o Maya. Para sa eksaktong halaga, tumawag po sa {PHONE}.",
        "thanks": "Walang anuman po! Mag-ingat po kayo, at magtanong lang kung may kailangan pa.",
        "medical_advice": f"Pasensya na po, hindi ako makapag-diagnose, makapag-rekomenda ng gamot, o magbigay ng dosage. Makipag-usap po sa aming nurse o doktor sa center, o tumawag sa {PHONE}.",
        "off_topic": "Ang maitutulong ko lang po ay mga tanong tungkol sa EZ Animal Bite Center, gaya ng oras, lokasyon, serbisyo, bayad, at pangunahing first aid.",
        "about_system": f"Pasensya na po, wala po akong impormasyon tungkol diyan. Mga tanong lang po tungkol sa clinic ang masasagot ko. Para sa iba pa, tumawag po sa {PHONE}.",
        "staff_info": f"Para sa mga tanong tungkol sa aming staff o kung sino ang naka-duty, makipag-ugnayan po sa center sa {PHONE} sa oras ng clinic.",
        "bot_identity": "Ako po ang virtual assistant ng EZ Animal Bite Center, hindi tao. Masasagot ko ang mga pangunahing tanong tungkol sa clinic at makapagbibigay ng pangunahing first aid, pero hindi ako makapagbibigay ng medikal na payo.",
        "unknown": f"Hindi ko po masyadong naintindihan iyon. Matutulungan ko po kayo sa oras, lokasyon, contact, serbisyo, bayad, at first aid. Para sa iba pa, tumawag po sa {PHONE}.",
    },
}
OPTIONS = {
    "en": ["Clinic hours", "Where is the clinic?", "First aid steps", "Phone number"],
    "fil": ["Clinic hours", "Where is the clinic?", "First aid steps", "Phone number"],
}

# Common Filipino words. If any appear, the reply is in Filipino.
FIL_WORDS = {
    "ako", "ko", "mo", "ka", "ng", "ang", "ba", "po", "kayo", "ninyo", "namin", "natin", "anong", "ano",
    "saan", "kailan", "magkano", "paano", "pano", "bakit", "sino", "nakagat", "kinagat", "nakalmot",
    "gusto", "pwede", "pwedeng", "mga", "naman", "lang", "kasi", "bukas", "oras", "bakuna", "turok",
    "sugat", "aso", "pusa", "salamat", "kumusta", "kamusta", "musta", "magandang", "gagawin", "gawin",
    "tao", "nasaan", "ilang", "bayad", "ngayon", "kagat", "kalmot", "dapat", "hindi", "wala", "meron",
}

model = joblib.load("model.pkl")
vectorizer = joblib.load("vectorizer.pkl")

app = Flask(__name__)


def detect_lang(text):
    words = set(re.findall(r"[a-zñ']+", text.lower()))
    return "fil" if words & FIL_WORDS else "en"


@app.after_request
def add_cors(resp):
    # Local development only. In production, call this service from the LavaLust backend.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip().lower()
    if not message or len(message) > 500:
        return jsonify({"error": "message is required (max 500 characters)"}), 400

    lang = detect_lang(message)
    probs = model.predict_proba(vectorizer.transform([message]))[0]
    best = probs.argmax()
    intent = model.classes_[best]
    confidence = float(probs[best])

    uncertain = confidence < CONFIDENCE_THRESHOLD
    if uncertain:
        intent = "unknown"

    return jsonify({
        "intent": intent,
        "confidence": round(confidence, 3),
        "reply": REPLIES[lang][intent],
        "options": OPTIONS[lang],
        "uncertain": uncertain,
        "lang": lang,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)