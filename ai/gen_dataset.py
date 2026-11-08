"""Generate dataset.csv (about 2000+ rows) from hand-written phrases.
holdout_test.csv (hand-written lines) is NEVER used for training.
Run: py gen_dataset.py
"""
import csv, random
random.seed(7)

A_EN = ["dog","cat","stray dog","puppy","kitten","monkey","rat","bat","neighbor's dog","pet dog"]
A_FIL = ["aso","pusa","askal","tuta","kuting","unggoy","daga","paniki","aso ng kapitbahay","alagang aso"]
BITE = (
    [f"i was bitten by a {a}" for a in A_EN] + [f"a {a} bit me" for a in A_EN] +
    [f"i got scratched by a {a}" for a in A_EN] + [f"my child was bitten by a {a}" for a in A_EN] +
    [f"bitten by a {a} what do i do" for a in A_EN] +
    [f"nakagat ako ng {a}" for a in A_FIL] + [f"kinagat ako ng {a}" for a in A_FIL] +
    [f"nakalmot ako ng {a}" for a in A_FIL] + [f"nakagat ang anak ko ng {a}" for a in A_FIL] +
    [f"nakagat ako ng {a} ano gagawin ko" for a in A_FIL] +
    [f"may kumagat sa akin na {a}" for a in A_FIL] +
    ["my dog bit my hand","the dog bit my leg and it is bleeding","may sugat ako galing sa kagat ng aso",
     "nakagat ako sa binti","nakagat ako sa kamay","my toddler got bitten","kagat ng aso sa braso ko",
     "there is a bite on my arm","i have a bite wound","may kagat ako sa paa","dumugo ang kagat sa akin"]
)
DX = ["rabies","tetanus","an infection","a serious wound","something dangerous"]
MEDICAL = (
    [f"do i have {d}" for d in DX] + [f"am i going to get {d}" for d in DX] +
    ["may rabies na ba ako","may impeksyon ba ang sugat ko","mamamatay ba ako","will i die from this",
     "what medicine should i take","anong gamot ang pwede kong inumin","can i take amoxicillin",
     "pwede ba akong uminom ng antibiotic","how many tablets should i take","ilang tableta ang iinumin ko",
     "what dose of paracetamol","anong dosage ng gamot","is my wound serious","malala ba ang sugat ko",
     "diagnose my wound","tell me if i need stitches","kailangan ko ba ng tahi","do i need a tetanus shot",
     "kailangan ko ba ng tetanus","should i skip my vaccine","pwede bang hindi na ako magpabakuna",
     "can i drink alcohol after the shot","pwede ba uminom ng alak habang nagpapabakuna",
     "is it safe for pregnant women","ligtas ba sa buntis ang bakuna","can i give the shot to my dog",
     "pwede bang ako na ang mag inject","is it okay to use herbal medicine on the wound","pwede ba ang tuob sa sugat"]
)
OFFTOPIC = ["tell me a joke","what is the weather","who is the president","write my essay","what is 2 plus 2",
    "recommend a movie","anong ulam ngayon","sino ang pinakamagaling na artista","how to cook adobo",
    "pogi ba ako","maganda ba ako","kumain ka na ba","may jowa ka ba","sing me a song","tell me a story",
    "what is your favorite color","who is the best basketball player","how to fix my phone","pano mag luto ng sinigang",
    "anong oras na sa japan","what is the meaning of life","sino ang crush mo","gusto mo ba ng pizza",
    "can you help me with math","translate this to korean","kwentuhan mo ako","do you like music","ano ang paborito mong kanta"]
P = {
 "greeting": ["hello","hi","hey","good morning","good afternoon","good evening","kumusta","kumusta po","musta",
    "magandang umaga","magandang hapon","magandang gabi","hello po","hi po","hey there","may tao ba","anyone there",
    "hello is anyone there","start","kamusta ka","how are you","kumusta ka na"],
 "first_aid": ["first aid for animal bite","first aid steps","what should i do after a bite","how do i clean a bite wound",
    "should i wash the wound","how long should i wash the wound","do i use soap and water","should i put alcohol on the wound",
    "pwede ba lagyan ng alcohol ang sugat","ano ang first aid sa kagat","paano gamutin ang kagat","dapat ba hugasan ang sugat",
    "ilang minuto hugasan ang sugat","sabon at tubig ba ang gagamitin","ano ang gagawin ko bago pumunta sa clinic",
    "what to do before going to the clinic","how to stop the bleeding from a bite","paano pigilan ang dugo sa sugat",
    "pano linisin ang kagat","should i cover the wound","dapat ko bang takpan ang sugat","what do i do right now",
    "ano ang unang gagawin","immediate steps after a bite","anong dapat gawin agad"],
 "hours": ["what time do you open","what time do you close","clinic hours","operating hours","are you open today",
    "are you open now","are you open on sunday","are you open on holidays","until what time are you open",
    "anong oras kayo bukas","anong oras kayo nagsasara","bukas ba kayo ngayon","bukas ba kayo kapag linggo",
    "bukas ba kayo sa holiday","anong oras ang sara","oras ng clinic","open pa ba kayo","hanggang anong oras kayo",
    "anong araw kayo bukas","what days are you open","schedule ng clinic","business hours","what are your hours"],
 "location": ["where is the clinic","where are you located","what is your address","how do i get to the clinic",
    "directions to the center","where is ez animal bite center","is the clinic near the highway","how far is the clinic",
    "saan ang clinic","saan kayo located","nasaan ang clinic","ano ang address ninyo","paano pumunta sa clinic",
    "saan ang ez animal bite center","malapit ba kayo sa bayan","may landmark ba kayo","saan sa calapan kayo",
    "where in calapan are you","how to find the center","paano kayo hanapin","address po","location po","pa send ng location"],
 "contact": ["phone number","contact number","what is your phone number","how can i contact you","can i call the clinic",
    "do you have a facebook page","can i text you","mobile number of the clinic","landline number","email address",
    "ano ang number ng clinic","number po ng clinic","paano kayo makokontak","pwede ko ba kayong tawagan",
    "may facebook page ba kayo","pwede ba mag text","cp number ng clinic","may email ba kayo","pano kayo tawagan",
    "contact details","how do i reach the center","paano makipag ugnayan sa inyo"],
 "services": ["what services do you offer","what services are available","do you give rabies vaccine",
    "do you offer anti rabies shots","do you treat animal bites","do you do wound cleaning","do you keep patient records",
    "can you give the vaccine to children","what can the center do","list of services",
    "anong serbisyo ang meron kayo","may anti rabies ba kayo","nagbibigay ba kayo ng bakuna","ano ang mga services ninyo",
    "ginagamot ba ninyo ang kagat","pwede ba sa bata ang bakuna","ano ang kaya ng clinic","may rabies vaccine ba kayo",
    "may serbisyo ba kayo para sa kagat","anong mga bakuna ang meron","do you also treat scratches","gamutan ba ng kalmot"],
 "vaccine_followup": ["how many doses of the vaccine","how many shots do i need","when is my next dose","when is my next shot",
    "i missed my vaccine schedule","i missed my second dose","i am late for my next dose","can i get a reminder for my next dose",
    "will you send me an sms reminder","how long is the vaccination schedule","what is day 0 3 7","how do i know my schedule",
    "ilang turok ang kailangan","kailan ang susunod na turok","kailan ang susunod na bakuna ko","na miss ko ang schedule",
    "late na ako sa susunod na turok","may sms reminder ba","pano ko malalaman ang schedule ko","gaano katagal ang bakuna",
    "ilang beses ang turok","nakalimutan ko ang bakuna ko","pwede bang ma delay ang turok","follow up ko kailan"],
 "appointment": ["can i book an appointment","how do i make an appointment","do you accept walk ins","do i need to book first",
    "can i come today","can i reschedule my appointment","i want to cancel my appointment","what time can i visit",
    "i want to schedule a visit","is there a queue","paano mag set ng appointment","pwede ba walk in","kailangan ba mag book muna",
    "pwede ba ako pumunta ngayon","gusto kong magpa schedule","pwede ba i reschedule","gusto kong i cancel ang appointment",
    "may pila ba","anong oras pwede pumunta","pwede bang magpa book","walk in lang ba o appointment"],
 "fees": ["how much is the vaccine","how much does it cost","what is the service fee","how much is the consultation",
    "do you accept gcash","do you accept maya","can i pay in cash","what payment methods do you accept","is there an online payment",
    "how much is the anti rabies shot","magkano ang bakuna","magkano ang bayad","magkano ang konsulta","tumatanggap ba kayo ng gcash",
    "pwede ba mag bayad sa maya","pwede cash","anong payment methods","may online payment ba","magkano ang turok","magkano po lahat",
    "how much for the whole series","magkano ang buong bakuna"],
 "thanks": ["thank you","thanks","thanks a lot","thank you so much","ok thanks","okay thank you","salamat","salamat po",
    "maraming salamat","maraming salamat po","ok salamat","salamat sa tulong","thanks for the help","sige salamat","got it thanks"],
 "about_system": ["what is bitebridge","who made bitebridge","who developed this system","who built this website","how was this chatbot made",
    "what technology does this system use","is this a capstone project","who are the researchers","can i get the source code",
    "what database does this system use","what programming language is this","how does bitebridge work","tell me about the bitebridge system",
    "sino ang gumawa ng website na ito","sino ang developer ng system","anong programming language ang gamit","ano ang bitebridge",
    "paano gumagana ang bitebridge","sino ang gumawa ng chatbot","sino ang gumawa ng system na ito","ano ang gamit na database ng system",
    "proyekto ba ito ng estudyante","sino ang nag program nito","paano ginawa ang chatbot na ito"],
 "staff_info": ["who are the staff","who is the doctor","who is the nurse","who is the physician","who owns the clinic",
    "who is on duty today","is the doctor available","is a nurse available","who will assess my wound","can i talk to the nurse",
    "can i speak with the doctor","who is in charge of the clinic","how many staff do you have","what are the names of the staff",
    "sino ang mga staff","sino ang doktor","sino ang nurse","sino ang physician","sino ang may ari ng clinic","sino ang nasa duty ngayon",
    "nandiyan ba ang doktor","nandiyan ba ang nurse","sino ang titingin sa sugat ko","pwede ko bang makausap ang nurse",
    "sino ang namamahala sa clinic","ilan ang staff ninyo","ano ang pangalan ng doktor"],
 "bot_identity": ["who are you","are you a robot","are you a real person","are you a bot","are you ai","what is your name",
    "is this a real person","are you human","what are you","sino ka","ikaw ba ay tao","tao ka ba","ano ka","anong pangalan mo",
    "robot ka ba","totoong tao ba ito","sino ang kausap ko","are you chatgpt"],
}
P["bite_report"] = BITE
P["medical_advice"] = MEDICAL
P["off_topic"] = OFFTOPIC
TARGET = {"bite_report":400,"medical_advice":300,"off_topic":260,"greeting":180,"thanks":140,
          "bot_identity":150,"about_system":200,"staff_info":200}
DEFAULT = 290
PRE = ["","","","","hi ","hello ","excuse me ","tanong lang ","pwede magtanong ","pls ","po ","hello po ","sir ","maam ","good day ","hi po ","pasensya na po ","uhm ","ask ko lang ","hi admin ","hello sir ","paki sagot ","urgent ","quick question "]
SUF = ["","","",""," po"," please"," pls"," ba"," po ba"," kasi"," thanks"," hello"," ?","?"," po sir"," po maam"," thank you"," salamat"," asap"," po pls"," agad"]
def typo(s):
    if random.random() > 0.25 or len(s) < 6: return s
    i = random.randrange(1, len(s)-1); k = random.choice(["drop","swap","dup"])
    if k == "drop": return s[:i]+s[i+1:]
    if k == "swap": return s[:i]+s[i+1]+s[i]+s[i+2:]
    return s[:i]+s[i]+s[i:]
hold = {r["text"].lower().strip() for r in csv.DictReader(open("holdout_test.csv", encoding="utf-8"))}
rows = []
for intent, phrases in P.items():
    want = TARGET.get(intent, DEFAULT); seen = set(); tries = 0
    while len(seen) < want and tries < 20000:
        tries += 1
        t = typo((random.choice(PRE)+random.choice(phrases)+random.choice(SUF)).strip().lower())
        t = " ".join(t.split())
        if t and t not in hold: seen.add(t)
    rows += [(t, intent) for t in seen]
random.shuffle(rows)
with open("dataset.csv","w",newline="",encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["text","intent"]); w.writerows(rows)
print(len(rows), "rows")