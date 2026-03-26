export interface VoiceSampleLanguage {
  code: string
  name: string
  nativeName: string
  prompt: string
}

export const VOICE_SAMPLE_LANGUAGES: VoiceSampleLanguage[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', prompt: 'مرحبًا، اسمي {name}. أسجّل هذه الجملة ليتم التعرّف على صوتي بشكل صحيح في المحادثات.' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', prompt: 'Здравейте, казвам се {name}. Записвам това изречение, за да бъде гласът ми разпознат правилно в разговорите.' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', prompt: 'Hola, em dic {name}. Enregistro aquesta frase perquè la meva veu sigui identificada correctament a les converses.' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', prompt: 'Dobrý den, jmenuji se {name}. Nahrávám tuto větu, aby byl můj hlas správně rozpoznán v konverzacích.' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', prompt: 'Hej, mit navn er {name}. Jeg optager denne sætning, så min stemme kan genkendes korrekt i samtaler.' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', prompt: 'Hallo, mein Name ist {name}. Ich spreche diesen Satz auf, damit meine Stimme in Gesprächen korrekt erkannt wird.' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', prompt: 'Γεια σας, ονομάζομαι {name}. Ηχογραφώ αυτή τη φράση ώστε η φωνή μου να αναγνωρίζεται σωστά στις συνομιλίες.' },
  { code: 'en', name: 'English', nativeName: 'English', prompt: 'Hello, my name is {name}. I am recording this sentence so my voice can be correctly identified in conversations.' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', prompt: 'Hola, me llamo {name}. Estoy grabando esta frase para que mi voz sea identificada correctamente en las conversaciones.' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', prompt: 'Tere, minu nimi on {name}. Salvestan selle lause, et minu häält saaks vestlustes õigesti tuvastada.' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', prompt: 'Hei, nimeni on {name}. Nauhoitan tämän lauseen, jotta ääneni voidaan tunnistaa oikein keskusteluissa.' },
  { code: 'fr', name: 'French', nativeName: 'Français', prompt: 'Bonjour, je m\'appelle {name}. J\'enregistre cette phrase afin que ma voix soit correctement identifiée dans les conversations.' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', prompt: 'שלום, שמי {name}. אני מקליט משפט זה כדי שהקול שלי יזוהה נכון בשיחות.' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', prompt: 'नमस्ते, मेरा नाम {name} है। मैं यह वाक्य रिकॉर्ड कर रहा हूँ ताकि बातचीत में मेरी आवाज़ को सही ढंग से पहचाना जा सके।' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', prompt: 'Pozdrav, zovem se {name}. Snimam ovu rečenicu kako bi se moj glas ispravno prepoznao u razgovorima.' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', prompt: 'Üdvözlöm, a nevem {name}. Ezt a mondatot azért rögzítem, hogy a hangomat helyesen azonosítsák a beszélgetések során.' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', prompt: 'Halo, nama saya {name}. Saya merekam kalimat ini agar suara saya dapat dikenali dengan benar dalam percakapan.' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', prompt: 'Salve, mi chiamo {name}. Sto registrando questa frase affinché la mia voce possa essere identificata correttamente nelle conversazioni.' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', prompt: 'こんにちは、{name}です。会話の中で私の声が正しく識別されるよう、この文を録音しています。' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', prompt: '안녕하세요, 제 이름은 {name}입니다. 대화에서 제 목소리를 정확하게 식별할 수 있도록 이 문장을 녹음합니다.' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', prompt: 'Sveiki, mano vardas {name}. Įrašau šį sakinį, kad mano balsas būtų teisingai atpažintas pokalbiuose.' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', prompt: 'Sveiki, mani sauc {name}. Es ierakstu šo teikumu, lai manu balsi varētu pareizi atpazīt sarunās.' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', prompt: 'Halo, nama saya {name}. Saya merakam ayat ini supaya suara saya dapat dikenal pasti dengan betul dalam perbualan.' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', prompt: 'Hallo, mijn naam is {name}. Ik neem deze zin op zodat mijn stem correct herkend kan worden in gesprekken.' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', prompt: 'Hei, mitt navn er {name}. Jeg tar opp denne setningen slik at stemmen min kan gjenkjennes riktig i samtaler.' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', prompt: 'سلام، نام من {name} است. این جمله را ضبط می‌کنم تا صدای من در مکالمات به‌درستی شناسایی شود.' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', prompt: 'Dzień dobry, nazywam się {name}. Nagrywam to zdanie, aby mój głos mógł być prawidłowo rozpoznawany w rozmowach.' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', prompt: 'Olá, meu nome é {name}. Estou gravando esta frase para que minha voz seja corretamente identificada nas conversas.' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', prompt: 'Bună ziua, numele meu este {name}. Înregistrez această propoziție pentru ca vocea mea să fie identificată corect în conversații.' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', prompt: 'Здравствуйте, меня зовут {name}. Я записываю это предложение, чтобы мой голос правильно распознавался в разговорах.' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', prompt: 'Dobrý deň, volám sa {name}. Nahrávam túto vetu, aby bol môj hlas správne rozpoznaný v konverzáciách.' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', prompt: 'Pozdravljeni, ime mi je {name}. Snemam ta stavek, da bo moj glas pravilno prepoznan v pogovorih.' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', prompt: 'Hej, mitt namn är {name}. Jag spelar in den här meningen så att min röst kan identifieras korrekt i samtal.' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', prompt: 'สวัสดีครับ ผมชื่อ {name} ผมบันทึกประโยคนี้เพื่อให้เสียงของผมถูกระบุอย่างถูกต้องในการสนทนา' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', prompt: 'Merhaba, benim adım {name}. Konuşmalarda sesimin doğru tanınabilmesi için bu cümleyi kaydediyorum.' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', prompt: 'Вітаю, мене звати {name}. Я записую це речення, щоб мій голос правильно розпізнавався під час розмов.' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', prompt: 'Xin chào, tên tôi là {name}. Tôi đang ghi âm câu này để giọng nói của tôi được nhận dạng chính xác trong các cuộc trò chuyện.' },
  { code: 'zh', name: 'Mandarin', nativeName: '中文', prompt: '你好，我的名字是{name}。我正在录制这句话，以便在对话中正确识别我的声音。' },
]

export function getVoiceSampleLanguage(code: string): VoiceSampleLanguage | undefined {
  return VOICE_SAMPLE_LANGUAGES.find((l) => l.code === code)
}

export function getVoiceSamplePrompt(code: string, name: string): string {
  const lang = getVoiceSampleLanguage(code)
  if (!lang) return `Hello, my name is ${name}. I am recording this sentence so my voice can be correctly identified in conversations.`
  return lang.prompt.replace('{name}', name)
}
