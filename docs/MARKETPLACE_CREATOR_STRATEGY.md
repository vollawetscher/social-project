# Notissima Marketplace: Creator-Strategie

**Datum:** Maerz 2026
**Status:** Strategiedokument / Entscheidungsgrundlage

---

## Zusammenfassung

Notissima nutzt den Marketplace als **Lead-Generierungs-Plattform fuer Notion-Creator und -Berater**. Templates sind kostenlos. Creator monetarisieren nicht ueber Template-Verkaeufe, sondern ueber **qualifizierte Leads** -- Nutzer, die beim Installieren eines Templates ihre Kontaktdaten freigeben. Notissima wickelt keine Zahlungen ab. Der eingebaute IP-Schutz (Prompts bleiben unsichtbar) ist das zentrale Differenzierungsmerkmal gegenueber Gumroad oder Lemonsqueezy.

---

# Teil 1: Go-to-Market -- Creator als Vertriebskanal

## Warum Notion-Creator der ideale Wachstumstreiber sind

Notion hat kein eigenes Monetarisierungsmodell fuer Templates. Creator haben sich deshalb ein externes Oekosystem aufgebaut:

| Plattform | Funktion | Reichweite |
|-----------|----------|------------|
| Gumroad / Lemonsqueezy | Template-Verkauf | 500 -- 20.000 bisherige Kaeufer |
| YouTube | Tutorials, Workflows | 5.000 -- 500.000 Subscriber |
| Twitter/X | Community, Promotion | 2.000 -- 100.000 Follower |
| Email-Liste | Direkte Kommunikation | 1.000 -- 50.000 Kontakte |
| Discord / Communities | Engagement | 500 -- 10.000 Mitglieder |
| Notion Template Gallery | Kostenlose Reichweite | Tausende Views/Monat |

**Ein einziger mittelgrosser Creator kann potenziell mehr User bringen als Monate eigener Marketing-Arbeit.**

Diese Creator suchen staendig nach Wegen, ihren Kunden mehr Wert zu bieten und sich von anderen Notion-Template-Anbietern abzuheben. Voice-Input ist ein Feature, das kein anderer Template-Anbieter hat -- das macht Notissima zum perfekten Differenzierungsmerkmal fuer Creator.

## Die 5 Distributions-Kanaele

### Kanal 1: In-Product Placement (staerkster Kanal)

Der Creator baut einen Hinweis **direkt in sein Notion-Template** ein -- z.B. eine Seite "Voice Input Setup" oder einen Callout-Block auf der Hauptseite mit direktem Link zum passenden Notissima-Template.

**Warum das so stark ist:**
- Der User ist bereits im Notion-Template und sucht aktiv nach Wegen, es zu befuellen
- Er hat bereits bezahlt (fuer das Notion-Template) -- hohe Kaufkraft und Commitment
- Der Creator erwischt den perfekten Moment: "Du hast gerade mein CRM-Template gekauft? So fuellst du es 10x schneller."
- Kein Werbe-Budget noetig -- die Distribution passiert innerhalb des Produkts

**Beispiel:** Creator verkauft "Notion CRM fuer Freelancer" auf Gumroad (29 EUR). Im Template gibt es eine Seite "Quick Setup Guide" mit dem Hinweis: "Neuen Kontakt per Sprache hinzufuegen? Installiere das passende Notissima Voice-Template: [Link]"

### Kanal 2: Content / YouTube

Creator produziert ein Video: "How I use voice to fill my Notion templates 10x faster" -- zeigt den Workflow (Sprache aufnehmen, Notissima, Output in Notion pasten) und verlinkt das Template in der Video-Beschreibung. Erreicht tausende Notion-User mit genau diesem Problem.

### Kanal 3: Bundle mit Notion-Template

Creator bietet sein Gumroad-Produkt als Bundle an: "Notion CRM Template (29 EUR) + Passendes Notissima Voice-Template (gratis)". Der Notissima-Teil ist kostenlos, aber erhoehrt den wahrgenommenen Wert des Bundles.

### Kanal 4: Email-Liste

Creator informiert seine Subscriber: "Neues Feature fuer mein [Template Name]: Sprachinput ueber Notissima" mit direktem Link. Bei 5.000+ Subscribern kann das allein hunderte Signups bringen.

### Kanal 5: Community / Social Media

Creator postet in Discord/Twitter: "Ich habe ein Notissima-Template gebaut das perfekt zu meinem [Notion Template] passt" -- mit Screenshot/GIF vom Workflow und Link.

## Konkreter Akquise-Plan: Die ersten 10 Creator

| Schritt | Aktion | Ziel |
|---------|--------|------|
| 1 | 5--10 Notion-Creator auf Twitter/YouTube identifizieren, die Templates verkaufen | Zielgruppe finden |
| 2 | Fuer jeden Creator ein Notissima-Template erstellen, das zu seinem Top-Notion-Template passt | Zeigen statt reden |
| 3 | Creator anschreiben: "Ich habe ein Voice-Input-Template gebaut, das perfekt zu deinem [Notion Template] passt. Deine Kunden koennten damit per Sprache Daten eingeben. Willst du es ausprobieren?" | Tuer oeffnen |
| 4 | Demo-Call anbieten (15 Min, natuerlich per Notissima) | Vertrauen aufbauen |
| 5 | Creator-Profil einrichten, Template unter seinem Namen publizieren | Win-Win schaffen |

**Entscheidend:** Die ersten Templates werden **fuer** die Creator erstellt, nicht von ihnen. Das senkt die Einstiegshuerde massiv. Erst wenn sie den Wert sehen, erstellen sie eigene.

## Der Flywheel-Effekt

1. Notissima baut Template fuer Creator's Notion-Produkt
2. Creator bekommt fertiges Voice-Template und baut Hinweis in sein Notion-Template ein
3. Creator's Kunden (Notion-User) entdecken Notissima beim Nutzen des Notion-Templates
4. User meldet sich bei Notissima an, installiert Template (Lead fuer Creator)
5. Creator sieht Wert, erstellt weitere Templates
6. Marketplace wird wertvoller, zieht mehr User an
7. Mehr User ziehen weitere Creator an
8. Zurueck zu Schritt 1

**Der Schluessel ist: die ersten Templates fuer Creator bauen, nicht darauf warten, dass sie es selbst tun.**

---

# Teil 2: Was Notissima dafuer braucht (Produkt-Features)

## 2.1 Creator-Profil

### Bestehende Felder (bereits in der DB)
- `marketplace_username` -- Creator-Name
- `marketplace_bio` -- Kurzbeschreibung (max 500 Zeichen)
- `marketplace_avatar_url` -- Profilbild

### Neue Felder
- **Tagline** -- Einzeiler, z.B. "Notion-Berater fuer Produktivitaets-Workflows" (max 120 Zeichen)
- **Services** -- Was bietet der Creator an? Freitext (max 500 Zeichen)
- **Website** -- Eigene Website URL
- **Notion Gallery** -- Link zum Notion-Template-Gallery-Profil
- **Social Links** -- Twitter/X, YouTube, LinkedIn (jeweils optional)
- **Kontakt-Email fuer Leads** -- Kann abweichen von der Account-Email
- **Verfuegbarkeit** -- Toggle: "Verfuegbar fuer Consulting-Anfragen"

### Oeffentliche Creator-Profil-Seite

Route: `/marketplace/creators/[username]`

Aufbau:
1. **Header:** Avatar, Name, Tagline, Verfuegbarkeits-Badge, Social-Link-Icons
2. **Services:** Ueberschrift "Angebote & Services", Services-Text, "Kontakt aufnehmen" Button
3. **Templates-Grid:** Alle publizierten Templates des Creators
4. **Statistiken:** Anzahl Templates, Downloads gesamt, Durchschnittsbewertung

## 2.2 Open vs. Gated Templates

Der Creator entscheidet pro Template, ob es "Open" oder "Gated" ist.

**Open Template:**
- Sofort installierbar (wie bisher)
- Creator bekommt anonyme Statistiken (Downloads, Ratings)
- Geeignet fuer: Reichweite, Vertrauensaufbau, einfache Templates

**Gated Template:**
- Vor dem Install: Consent-Dialog mit Email/Name-Freigabe
- Creator bekommt qualifizierten Lead
- Geeignet fuer: hochwertige Templates, Consulting-Pipeline

Im Marketplace erhalten Gated Templates einen dezenten Hinweis ("Kontaktdaten erforderlich") unter dem Install-Button.

## 2.3 Consent-Dialog (Gated Templates)

Wenn ein User ein Gated Template installieren will, erscheint ein Dialog:

1. **Creator-Card** oben im Dialog: Avatar, Name, Tagline, Verfuegbarkeits-Badge
2. **Erklaertext:** "Dieses Template wird bereitgestellt von [Creator-Name]. Um es zu installieren, teile deinen Namen und deine Email-Adresse. [Creator-Name] kann dich kontaktieren, um dir bei der Einrichtung zu helfen oder individuelle Loesungen anzubieten."
3. **Formular:** Name (vorausgefuellt), Email (vorausgefuellt), optionale Nachricht an Creator
4. **DSGVO-Checkbox** (nicht vorausgewaehlt): "Ich stimme zu, dass meine Kontaktdaten an [Creator-Name] weitergegeben werden [...]"
5. **Buttons:** "Installieren und Kontakt teilen" (primaer) / "Abbrechen"

Nach dem Install: Toast "Template installiert! [Creator-Name] wurde benachrichtigt." Creator erhaelt Email mit Lead-Details.

## 2.4 Creator Dashboard

Route: `/marketplace/dashboard`

Drei Tabs:

**Tab 1 -- Meine Templates:**
- Liste aller publizierten Templates mit Typ (Open/Gated), Downloads, Rating
- Actions: Bearbeiten, Typ aendern, Unpublish

**Tab 2 -- Leads (Kern-Feature):**
- Tabelle: Name, Email, Template, Nachricht, Datum, Status
- Status-Tags: "Neu", "Kontaktiert", "Archiviert" (manuell durch Creator)
- Filter nach Template, Status, Zeitraum
- CSV-Export

**Tab 3 -- Statistiken:**
- Downloads und Leads pro Template
- Rating-Uebersicht
- Woechentlicher Trend-Vergleich

## 2.5 Referral-Tracking

Jeder Creator bekommt einen Referral-Link (`notissima.app/r/[username]`).

- Trackt Signups und Template-Installs, die ueber diesen Link kommen
- Creator sieht im Dashboard: "X Nutzer haben sich ueber deinen Link angemeldet"
- Optional spaeter: Deep-Links die direkt ein bestimmtes Template oeffnen, mit Auto-Install nach Signup

## 2.6 Notion-Template-Verknuepfung

Felder auf Marketplace-Templates:
- **Notion-Template-URL** -- Link zum passenden kostenpflichtigen Notion-Template
- **Notion-Template-Name** -- Name des Notion-Templates
- **Creator CTA-Text** -- Custom Call-to-Action

Im UI: Prominenter CTA-Block auf der Template-Detail-Seite ("Optimiert fuer [Notion Template Name] -- [Button: Notion Template ansehen]") und ein "Works with Notion" Badge.

## 2.7 User Consent-Verwaltung (DSGVO)

In den User-Settings ein neuer Abschnitt "Datenfreigaben":
- Liste aller Consent-Eintraege mit Creator-Name, Template-Name, Datum
- "Einwilligung widerrufen" Button pro Eintrag
- Bei Widerruf: Creator wird per Email aufgefordert, Daten zu loeschen. Template bleibt installiert.

## 2.8 Email-Benachrichtigungen

- **An Creator** bei neuem Lead: Name, Email, Nachricht, Link zum Dashboard
- **An User** als Bestaetigung: Welches Template, welcher Creator, Hinweis auf Widerrufsrecht
- **An Creator** bei Consent-Widerruf: Aufforderung zur Datenloeschung

## 2.9 Creator Toolkit (Marketing-Materialien)

Kein Code, sondern Inhalte die Notissima bereitstellt:
- Embed-Badges: "Works with Notissima", "Voice-Powered by Notissima" (PNG/SVG)
- Email-Vorlagen fuer Creator zum Anpassen
- Social-Media-Grafiken
- Kurze Anleitungstexte fuer Notion-Templates ("Kopiere diesen Text in dein Notion-Template")

## Aufwandsschaetzung

| Feature | Aufwand |
|---------|---------|
| Creator-Profil-Felder + API + Settings-UI | 2--3 Tage |
| Creator-Profil-Seite (oeffentlich) | 2 Tage |
| Open/Gated Template-Mechanik + Consent-Dialog | 2--3 Tage |
| Lead-Tabelle + Creator Dashboard (3 Tabs) | 3--4 Tage |
| User Consent-Verwaltung (Settings) | 1 Tag |
| Email-Benachrichtigungen (Creator + User) | 1--2 Tage |
| Marketplace-Seite (Featured Creators, Badges) | 1--2 Tage |
| Template-Detail-Seite (Creator Card, Notion-Block) | 1 Tag |
| Creator-Onboarding-Flow | 1 Tag |
| Referral-Link-System | 1--2 Tage |
| **Gesamt** | **ca. 17--23 Tage** |

---

# Teil 3: Warum Lead-Gen statt Stripe Connect

## Direkter Vergleich

| Aspekt | Lead-Gen-Modell | Stripe Connect (Revenue Share) |
|--------|----------------|-------------------------------|
| **Entwicklungsaufwand** | 17--23 Tage | 35--50 Tage (Payments, Compliance, Payouts) |
| **Laufender Aufwand** | Minimal | Hoch (Support, Refunds, Steuern, KYC) |
| **Creator-Onboarding** | Einfach (Links eintragen, Profil ausfuellen) | Komplex (Stripe-Konto verbinden, KYC, Bankdaten) |
| **Creator-Motivation** | "Kostenloser Kanal fuer qualifizierte Leads" | "Noch eine Plattform die Geld will" |
| **Skalierbarkeit** | Sofort (Link eintragen = fertig) | Langsam (jeder Creator braucht Stripe-Onboarding) |
| **Time-to-Market** | 3--4 Wochen | 2--3 Monate |
| **Compliance-Risiko** | Niedrig (nur DSGVO fuer Kontaktdaten) | Hoch (PSD2, Steuern, Rechnungen, Refunds) |
| **Notissima Revenue** | Indirekt ueber Plattform-Subscriptions | 15--30% pro Template-Verkauf |
| **User-Friction** | Niedrig (Template ist gratis, nur Email) | Hoch (Kreditkarte, Bezahlvorgang) |

## Vorteile fuer Creator

**Lead-Gen-Modell:**
- Ein qualifizierter Lead (jemand der aktiv Voice-to-Notion sucht) kann 500--5.000 EUR Consulting-Umsatz bringen
- 100 Leads zu je 5% Conversion = 5 Consulting-Auftraege = potenziell 2.500--25.000 EUR
- Zum Vergleich: 100 Template-Verkaeufe a 5 EUR (abzgl. 30% Plattform-Fee) = 350 EUR netto

**Stripe-Modell:**
- Template-Verkaeufe bringen typisch 2--20 EUR pro Stueck
- Nach Plattform-Fee bleiben 70--85%
- Braucht hohes Volumen um relevant zu sein
- Creator hat bei jedem anderen Marketplace die gleiche Option

**Fazit fuer Creator:** Ein Lead ist 10--100x mehr wert als ein Template-Verkauf. Das Lead-Gen-Modell spricht die Ebene "Business" an, nicht "Hobby".

## Vorteile fuer User

**Lead-Gen-Modell:**
- Alle Templates sind kostenlos
- Einziger "Preis" ist die Email-Adresse (mit explizitem Opt-in)
- Kein Bezahlvorgang, keine Kreditkarte, keine Friction
- User bekommt potenziell echte Hilfe vom Creator

**Stripe-Modell:**
- Bezahlvorgang vor dem Install
- Braucht Kreditkarte / Zahlungsmittel
- Refund-Erwartungen
- Hoehre Einstiegshuerde = weniger Installs = weniger Wachstum

## Vorteile fuer Notissima

**Lead-Gen-Modell:**
- Kein Payment-Infrastruktur-Aufwand
- Keine Compliance (KYC, Steuern, Rechnungen)
- Keine Refund-Streitigkeiten
- Schnelleres Wachstum (niedrigere Barrier fuer User UND Creator)
- Monetarisierung ueber Plattform-Subscription (Transkriptions-Minuten, KI-Analyse)
- Marketplace wird zum Acquisition Funnel, nicht zum Revenue Center

**Stripe-Modell:**
- Direkter Revenue (15--30% pro Verkauf)
- Aber: hoher Aufwand, langsam, Compliance-Last
- Und: bei geringem Volumen (wenige Creator, wenige Kaeufer) lohnt sich der Aufwand nicht

## Warum IP-Schutz das Differenzierungsmerkmal ist

Das entscheidende Argument gegenueber externen Plattformen:

**Auf Gumroad/Lemonsqueezy:** Creator verkauft ein Notissima-Template als JSON-Datei. Der Kaeufer erhaelt die Rohdatei inkl. des kompletten KI-Prompts. Er kann sie frei teilen, kopieren, weiterverkaufen. Der Prompt -- das eigentliche Know-how -- ist nicht geschuetzt.

**Im Notissima Marketplace:** Der Prompt bleibt auf dem Server. User koennen das Template nutzen, sehen aber nie den Prompt. Anti-Republishing verhindert, dass installierte Templates erneut im Marketplace hochgeladen werden. Das geistige Eigentum des Creators bleibt geschuetzt.

**Pitch an Creator:** "Dein Prompt ist dein Geschaeftsgeheimnis. Bei uns bleibt es geschuetzt. Auf Gumroad bekommt der Kaeufer die Rohdatei und kann sie beliebig kopieren."

Dieser IP-Schutz ist ein Feature, das **keine andere Plattform** bieten kann -- weil er direkt in die Ausfuehrungsumgebung integriert ist.

## Wann Stripe Connect spaeter sinnvoll werden koennte

Revenue-Share kann als **optionales Premium-Feature** hinzugefuegt werden, wenn:

- 50+ Creator aktiv auf der Plattform sind
- Creator explizit danach fragen ("Ich will Templates direkt verkaufen")
- Das Transaktionsvolumen den Compliance-Aufwand rechtfertigt (geschaetzt ab 500+ Verkaeufe/Monat)
- Notissima eine dedizierte Person fuer Payment-Operations hat

Bis dahin ist das Lead-Gen-Modell die richtige Wahl: schneller, einfacher, besser aligned mit dem was Creator wirklich wollen.

---

# Pitch-Zusammenfassung fuer Notion Creator

> **"Deine Notion-Follower tippen Daten muehsam ein. Mit Notissima sprechen sie einfach -- und der Output passt perfekt in dein Notion-Template.**
>
> **So funktioniert's:**
> 1. Erstelle ein kostenloses Notissima-Template, das strukturierten Output fuer dein Notion-Template liefert
> 2. Verlinke dein Notion-Template auf der Template-Seite
> 3. Jeder, der dein Template installiert, teilt seine Kontaktdaten mit dir
> 4. Du bekommst qualifizierte Leads -- Menschen, die aktiv nach Voice-to-Notion-Loesungen suchen
> 5. Biete ihnen Custom-Integrationen, Beratung oder deine Premium-Produkte an
>
> **Dein Prompt bleibt geschuetzt.** Auf Gumroad bekommt der Kaeufer die Rohdatei. Bei Notissima sieht niemand deinen Prompt -- er bleibt auf unseren Servern. Dein Know-how ist sicher."
