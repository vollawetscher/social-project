export interface VoiceSampleLanguage {
  code: string
  name: string
  nativeName: string
  prompt: string
}

export const VOICE_SAMPLE_LANGUAGES: VoiceSampleLanguage[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', prompt: 'مرحبًا، اسمي {name}. أسجّل هذه العينة الصوتية ليتم التعرّف على صوتي بشكل صحيح في المحادثات. هل يمكنكم سماعي بوضوح؟ أتمنى أن تكون هذه التسجيلة واضحة بما يكفي للتعرّف الدقيق.' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', prompt: 'Здравейте, казвам се {name}. Записвам тази гласова проба, за да бъде гласът ми разпознат правилно в разговорите. Чувате ли ме ясно? Надявам се този запис да е достатъчно ясен за точно разпознаване.' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', prompt: 'Hola, em dic {name}. Enregistro aquesta mostra de veu perquè la meva veu sigui identificada correctament a les converses. Em podeu sentir amb claredat? Espero que aquest enregistrament sigui prou clar per a un reconeixement precís.' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', prompt: 'Dobrý den, jmenuji se {name}. Nahrávám tento hlasový vzorek, aby byl můj hlas správně rozpoznán v konverzacích. Slyšíte mě dobře? Doufám, že tato nahrávka je dostatečně jasná pro přesné rozpoznání.' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', prompt: 'Hej, mit navn er {name}. Jeg optager denne stemmeprøve, så min stemme kan genkendes korrekt i samtaler. Kan I høre mig tydeligt? Jeg håber, at denne optagelse er tydelig nok til nøjagtig genkendelse.' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', prompt: 'Hallo, mein Name ist {name}. Ich nehme diese Sprachprobe auf, damit meine Stimme in Gesprächen korrekt erkannt werden kann. Können Sie mich gut verstehen? Ich hoffe, diese Aufnahme ist klar genug für eine genaue Erkennung.' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', prompt: 'Γεια σας, ονομάζομαι {name}. Ηχογραφώ αυτό το φωνητικό δείγμα ώστε η φωνή μου να αναγνωρίζεται σωστά στις συνομιλίες. Μπορείτε να με ακούσετε καθαρά; Ελπίζω αυτή η εγγραφή να είναι αρκετά καθαρή για ακριβή αναγνώριση.' },
  { code: 'en', name: 'English', nativeName: 'English', prompt: 'Hello, my name is {name}. I am recording this voice sample so my voice can be correctly identified in conversations. Can you hear me clearly? I hope this recording is clear enough for accurate recognition.' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', prompt: 'Hola, me llamo {name}. Estoy grabando esta muestra de voz para que mi voz sea identificada correctamente en las conversaciones. ¿Pueden escucharme con claridad? Espero que esta grabación sea lo suficientemente clara para un reconocimiento preciso.' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', prompt: 'Tere, minu nimi on {name}. Salvestan selle häälnäidise, et minu häält saaks vestlustes õigesti tuvastada. Kas te kuulete mind selgelt? Loodan, et see salvestus on piisavalt selge täpseks tuvastamiseks.' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', prompt: 'Hei, nimeni on {name}. Nauhoitan tämän ääninäytteen, jotta ääneni voidaan tunnistaa oikein keskusteluissa. Kuuletteko minut selvästi? Toivottavasti tämä nauhoitus on riittävän selkeä tarkkaan tunnistamiseen.' },
  { code: 'fr', name: 'French', nativeName: 'Français', prompt: 'Bonjour, je m\'appelle {name}. J\'enregistre cet échantillon vocal afin que ma voix soit correctement identifiée dans les conversations. Est-ce que vous m\'entendez clairement ? J\'espère que cet enregistrement est suffisamment clair pour une reconnaissance précise.' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', prompt: 'שלום, שמי {name}. אני מקליט דגימת קול זו כדי שהקול שלי יזוהה נכון בשיחות. האם אתם שומעים אותי בבירור? אני מקווה שהקלטה זו ברורה מספיק לזיהוי מדויק.' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', prompt: 'नमस्ते, मेरा नाम {name} है। मैं यह ध्वनि नमूना रिकॉर्ड कर रहा हूँ ताकि बातचीत में मेरी आवाज़ को सही ढंग से पहचाना जा सके। क्या आप मुझे स्पष्ट रूप से सुन पा रहे हैं? मुझे उम्मीद है कि यह रिकॉर्डिंग सटीक पहचान के लिए पर्याप्त स्पष्ट है।' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', prompt: 'Pozdrav, zovem se {name}. Snimam ovaj glasovni uzorak kako bi se moj glas ispravno prepoznao u razgovorima. Čujete li me jasno? Nadam se da je ova snimka dovoljno jasna za točno prepoznavanje.' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', prompt: 'Üdvözlöm, a nevem {name}. Ezt a hangmintát azért rögzítem, hogy a hangomat helyesen azonosítsák a beszélgetések során. Jól hallanak engem? Remélem, ez a felvétel elég tiszta a pontos felismeréshez.' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', prompt: 'Halo, nama saya {name}. Saya merekam sampel suara ini agar suara saya dapat dikenali dengan benar dalam percakapan. Apakah Anda bisa mendengar saya dengan jelas? Semoga rekaman ini cukup jelas untuk pengenalan yang akurat.' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', prompt: 'Salve, mi chiamo {name}. Sto registrando questo campione vocale affinché la mia voce possa essere identificata correttamente nelle conversazioni. Riuscite a sentirmi chiaramente? Spero che questa registrazione sia abbastanza chiara per un riconoscimento accurato.' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', prompt: 'こんにちは、{name}です。会話の中で私の声が正しく識別されるよう、この音声サンプルを録音しています。はっきり聞こえていますか？正確な認識のために、この録音が十分に明瞭であることを願っています。' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', prompt: '안녕하세요, 제 이름은 {name}입니다. 대화에서 제 목소리를 정확하게 식별할 수 있도록 이 음성 샘플을 녹음합니다. 제 목소리가 잘 들리시나요? 정확한 인식을 위해 이 녹음이 충분히 선명하기를 바랍니다.' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', prompt: 'Sveiki, mano vardas {name}. Įrašau šį balso pavyzdį, kad mano balsas būtų teisingai atpažintas pokalbiuose. Ar girdite mane aiškiai? Tikiuosi, kad šis įrašas yra pakankamai aiškus tiksliam atpažinimui.' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', prompt: 'Sveiki, mani sauc {name}. Es ierakstu šo balss paraugu, lai manu balsi varētu pareizi atpazīt sarunās. Vai jūs mani dzirdat skaidri? Ceru, ka šis ieraksts ir pietiekami skaidrs precīzai atpazīšanai.' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', prompt: 'Halo, nama saya {name}. Saya merakam sampel suara ini supaya suara saya dapat dikenal pasti dengan betul dalam perbualan. Bolehkah anda mendengar saya dengan jelas? Semoga rakaman ini cukup jelas untuk pengecaman yang tepat.' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', prompt: 'Hallo, mijn naam is {name}. Ik neem dit stemfragment op zodat mijn stem correct herkend kan worden in gesprekken. Kunt u mij duidelijk horen? Ik hoop dat deze opname helder genoeg is voor nauwkeurige herkenning.' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', prompt: 'Hei, mitt navn er {name}. Jeg tar opp denne stemmeprøven slik at stemmen min kan gjenkjennes riktig i samtaler. Kan dere høre meg tydelig? Jeg håper dette opptaket er tydelig nok til nøyaktig gjenkjennelse.' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', prompt: 'سلام، نام من {name} است. این نمونه صوتی را ضبط می‌کنم تا صدای من در مکالمات به‌درستی شناسایی شود. آیا صدای من را به وضوح می‌شنوید؟ امیدوارم این ضبط برای شناسایی دقیق به اندازه کافی واضح باشد.' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', prompt: 'Dzień dobry, nazywam się {name}. Nagrywam tę próbkę głosu, aby mój głos mógł być prawidłowo rozpoznawany w rozmowach. Czy słyszycie mnie wyraźnie? Mam nadzieję, że to nagranie jest wystarczająco wyraźne do dokładnego rozpoznawania.' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', prompt: 'Olá, meu nome é {name}. Estou gravando esta amostra de voz para que minha voz seja corretamente identificada nas conversas. Vocês conseguem me ouvir com clareza? Espero que esta gravação seja clara o suficiente para um reconhecimento preciso.' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', prompt: 'Bună ziua, numele meu este {name}. Înregistrez acest eșantion vocal pentru ca vocea mea să fie identificată corect în conversații. Mă auziți clar? Sper că această înregistrare este suficient de clară pentru o recunoaștere precisă.' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', prompt: 'Здравствуйте, меня зовут {name}. Я записываю этот голосовой образец, чтобы мой голос правильно распознавался в разговорах. Вы хорошо меня слышите? Надеюсь, эта запись достаточно чёткая для точного распознавания.' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', prompt: 'Dobrý deň, volám sa {name}. Nahrávam túto hlasovú vzorku, aby bol môj hlas správne rozpoznaný v konverzáciách. Počujete ma dobre? Dúfam, že táto nahrávka je dostatočne jasná na presné rozpoznanie.' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', prompt: 'Pozdravljeni, ime mi je {name}. Snemam ta glasovni vzorec, da bo moj glas pravilno prepoznan v pogovorih. Me slišite jasno? Upam, da je ta posnetek dovolj jasen za natančno prepoznavanje.' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', prompt: 'Hej, mitt namn är {name}. Jag spelar in det här röstprovet så att min röst kan identifieras korrekt i samtal. Kan ni höra mig tydligt? Jag hoppas att den här inspelningen är tillräckligt tydlig för korrekt igenkänning.' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', prompt: 'สวัสดีครับ ผมชื่อ {name} ผมบันทึกตัวอย่างเสียงนี้เพื่อให้เสียงของผมถูกระบุอย่างถูกต้องในการสนทนา คุณได้ยินผมชัดเจนไหมครับ? หวังว่าการบันทึกนี้จะชัดเจนเพียงพอสำหรับการจดจำที่แม่นยำ' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', prompt: 'Merhaba, benim adım {name}. Konuşmalarda sesimin doğru tanınabilmesi için bu ses örneğini kaydediyorum. Beni net duyabiliyor musunuz? Umarım bu kayıt doğru tanıma için yeterince açıktır.' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', prompt: 'Вітаю, мене звати {name}. Я записую цей голосовий зразок, щоб мій голос правильно розпізнавався під час розмов. Чи добре ви мене чуєте? Сподіваюся, цей запис достатньо чіткий для точного розпізнавання.' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', prompt: 'Xin chào, tên tôi là {name}. Tôi đang ghi âm mẫu giọng nói này để giọng nói của tôi được nhận dạng chính xác trong các cuộc trò chuyện. Các bạn có nghe rõ tôi không? Tôi hy vọng bản ghi âm này đủ rõ ràng để nhận dạng chính xác.' },
  { code: 'zh', name: 'Mandarin', nativeName: '中文', prompt: '你好，我的名字是{name}。我正在录制这个语音样本，以便在对话中正确识别我的声音。你们能听清楚我说话吗？希望这段录音足够清晰，能够准确识别。' },
]

export function getVoiceSampleLanguage(code: string): VoiceSampleLanguage | undefined {
  return VOICE_SAMPLE_LANGUAGES.find((l) => l.code === code)
}

export function getVoiceSamplePrompt(code: string, name: string): string {
  const lang = getVoiceSampleLanguage(code)
  if (!lang) return `Hello, my name is ${name}. I am recording this voice sample so my voice can be correctly identified in conversations. Can you hear me clearly? I hope this recording is clear enough for accurate recognition.`
  return lang.prompt.replace('{name}', name)
}
