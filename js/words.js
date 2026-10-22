// Startwortschatz A1–C1, nach Thema gruppiert.
// Format: [englisch, deutsch, Wortart, Niveau, Thema, Beispielsatz EN, Beispielsatz DE, Hinweis]
// Das Zielwort ist im Satz mit *Sternchen* markiert (auch in gebeugter Form).

export const TOPICS = {
  grundlagen: "Grundwortschatz",
  familie: "Familie & Freunde",
  reisen: "Reisen & Urlaub",
  camping: "Camping & Outdoor",
  rad: "Radfahren",
  verkehr: "Verkehr & Unterwegs",
  freizeit: "Freizeit, Sport & Kultur",
  alltag: "Alltag",
  essen: "Essen & Trinken",
  wohnen: "Wohnen & Haushalt",
  einkaufen: "Einkaufen & Service",
  gesundheit: "Gesundheit",
  charakter: "Menschen & Charakter",
  gefuehle: "Gefühle & Beziehungen",
  arbeit: "Arbeit & Karriere",
  bildung: "Bildung & Lernen",
  medien: "Medien & Kommunikation",
  wissenschaft: "Wissenschaft & Technik",
  umwelt: "Umwelt & Natur",
  wirtschaft: "Wirtschaft & Geld",
  recht: "Recht & Ordnung",
  politik: "Politik & Gesellschaft",
  denken: "Argumentieren & Denken",
  phrasal: "Phrasal Verbs & Redewendungen",
};

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

import { WORDBANK } from "./wordbank.js";

const RAW = [
  // ---------- Reisen & Urlaub ----------
  ["luggage", "Gepäck", "n", "B1", "reisen", "Our *luggage* didn't arrive with us.", "Unser *Gepäck* kam nicht mit uns an.", "unzählbar: a piece of luggage"],
  ["departure", "Abflug, Abfahrt", "n", "B1", "reisen", "*Departure* is at six in the morning.", "Der *Abflug* ist um sechs Uhr morgens.", ""],
  ["delay", "Verspätung", "n", "B1", "reisen", "The flight had a two-hour *delay*.", "Der Flug hatte zwei Stunden *Verspätung*.", ""],
  ["book", "buchen", "v", "B1", "reisen", "I *booked* a room with a sea view.", "Ich habe ein Zimmer mit Meerblick *gebucht*.", "fully booked = ausgebucht"],
  ["sightseeing", "Besichtigungen, Sightseeing", "n", "B1", "reisen", "We spent the morning *sightseeing*.", "Wir verbrachten den Vormittag mit *Besichtigungen*.", "go sightseeing"],
  ["destination", "Reiseziel", "n", "B2", "reisen", "Portugal is a popular *destination*.", "Portugal ist ein beliebtes *Reiseziel*.", ""],
  ["itinerary", "Reiseroute, Reiseplan", "n", "B2", "reisen", "Our *itinerary* includes three cities.", "Unsere *Reiseroute* umfasst drei Städte.", "Aussprache: /aɪˈtɪnərəri/"],
  ["accommodation", "Unterkunft", "n", "B2", "reisen", "*Accommodation* is expensive in summer.", "*Unterkünfte* sind im Sommer teuer.", "britisch meist unzählbar"],
  ["currency", "Währung", "n", "B2", "reisen", "You can pay in the local *currency*.", "Man kann in der Landes*währung* bezahlen.", ""],
  ["refund", "Rückerstattung", "n", "B2", "reisen", "I asked for a full *refund*.", "Ich bat um eine volle *Rückerstattung*.", "Verb: to refund = erstatten"],
  ["off the beaten track", "abseits der Touristenpfade", "phrase", "B2", "reisen", "We found a little village *off the beaten track*.", "Wir fanden ein kleines Dorf *abseits der Touristenpfade*.", ""],
  ["layover", "Zwischenstopp, Aufenthalt", "n", "C1", "reisen", "We had a long *layover* in Dubai.", "Wir hatten einen langen *Zwischenstopp* in Dubai.", "US; britisch auch: stopover"],
  ["picturesque", "malerisch", "adj", "C1", "reisen", "The old town is very *picturesque*.", "Die Altstadt ist sehr *malerisch*.", ""],
  ["embark", "aufbrechen; beginnen", "v", "C1", "reisen", "We *embarked* on a two-week road trip.", "Wir *brachen* zu einem zweiwöchigen Roadtrip *auf*.", "embark on something = etwas beginnen"],
  ["wanderlust", "Fernweh", "n", "C1", "reisen", "She was gripped by *wanderlust* again.", "Sie wurde wieder von *Fernweh* gepackt.", "aus dem Deutschen entlehnt – bedeutet aber Fernweh"],

  // ---------- Camping & Outdoor ----------
  ["tent", "Zelt", "n", "B1", "camping", "We put up the *tent* before dark.", "Wir bauten das *Zelt* vor Einbruch der Dunkelheit auf.", "put up / pitch a tent"],
  ["campsite", "Campingplatz", "n", "B1", "camping", "The *campsite* has hot showers.", "Der *Campingplatz* hat warme Duschen.", "US auch: campground"],
  ["sleeping bag", "Schlafsack", "n", "B1", "camping", "My *sleeping bag* wasn't warm enough.", "Mein *Schlafsack* war nicht warm genug.", ""],
  ["torch", "Taschenlampe", "n", "B1", "camping", "Don't forget to pack a *torch*.", "Vergiss nicht, eine *Taschenlampe* einzupacken.", "US: flashlight"],
  ["mosquito", "Mücke, Stechmücke", "n", "B1", "camping", "The *mosquitoes* kept us awake all night.", "Die *Mücken* hielten uns die ganze Nacht wach.", "Plural: mosquitoes"],
  ["pitch", "(Zelt) aufschlagen", "v", "B2", "camping", "We *pitched* our tent by the lake.", "Wir *schlugen* unser Zelt am See *auf*.", "als Nomen: Stellplatz"],
  ["firewood", "Brennholz", "n", "B2", "camping", "We collected *firewood* in the forest.", "Wir sammelten *Brennholz* im Wald.", "unzählbar"],
  ["shelter", "Unterschlupf, Schutz", "n", "B2", "camping", "We found *shelter* from the storm under a rock.", "Wir fanden unter einem Felsen *Schutz* vor dem Sturm.", "take shelter = Schutz suchen"],
  ["trail", "Wanderweg, Pfad", "n", "B2", "camping", "The *trail* leads up to a small lake.", "Der *Wanderweg* führt zu einem kleinen See hinauf.", ""],
  ["supplies", "Vorräte", "n", "B2", "camping", "We ran out of *supplies* on day three.", "Am dritten Tag gingen uns die *Vorräte* aus.", ""],
  ["drizzle", "Nieselregen", "n", "B2", "camping", "A light *drizzle* fell all morning.", "Den ganzen Vormittag fiel leichter *Nieselregen*.", ""],
  ["tarp", "Plane", "n", "B2", "camping", "We hung a *tarp* over the table.", "Wir spannten eine *Plane* über den Tisch.", ""],
  ["secluded", "abgeschieden", "adj", "C1", "camping", "We found a *secluded* spot by the river.", "Wir fanden einen *abgeschiedenen* Platz am Fluss.", ""],
  ["rugged", "zerklüftet, rau", "adj", "C1", "camping", "The coast is wild and *rugged*.", "Die Küste ist wild und *zerklüftet*.", ""],
  ["forage", "(Essbares) sammeln", "v", "C1", "camping", "We *foraged* for berries and mushrooms.", "Wir *sammelten* Beeren und Pilze.", "forage for something"],
  ["kindling", "Anzündholz", "n", "C1", "camping", "Use dry *kindling* to start the fire.", "Nimm trockenes *Anzündholz*, um das Feuer zu entfachen.", ""],

  // ---------- Radfahren ----------
  ["helmet", "Helm", "n", "B1", "rad", "Always wear a *helmet*.", "Trag immer einen *Helm*.", ""],
  ["flat tyre", "Platten, platter Reifen", "n", "B1", "rad", "I got a *flat tyre* on the way home.", "Ich hatte auf dem Heimweg einen *Platten*.", "US: flat tire"],
  ["brake", "bremsen", "v", "B1", "rad", "*Brake* gently on wet roads.", "*Bremse* auf nassen Straßen sanft.", "Nomen: the brakes = die Bremsen"],
  ["cycle path", "Radweg", "n", "B1", "rad", "The *cycle path* runs along the river.", "Der *Radweg* verläuft am Fluss entlang.", "US: bike path / bike lane"],
  ["gear", "Gang", "n", "B2", "rad", "Switch to a lower *gear* for the hill.", "Schalte für den Berg in einen niedrigeren *Gang*.", "auch: Ausrüstung (camping gear)"],
  ["steep", "steil", "adj", "B2", "rad", "The last climb was really *steep*.", "Der letzte Anstieg war richtig *steil*.", ""],
  ["pump up", "aufpumpen", "v", "B2", "rad", "I need to *pump up* my tyres.", "Ich muss meine Reifen *aufpumpen*.", ""],
  ["saddle", "Sattel", "n", "B2", "rad", "Lower the *saddle* a little.", "Stell den *Sattel* etwas tiefer.", ""],
  ["puncture", "Loch (im Reifen)", "n", "B2", "rad", "I fixed the *puncture* in ten minutes.", "Ich habe das *Loch* in zehn Minuten geflickt.", ""],
  ["overtake", "überholen", "v", "B2", "rad", "A truck *overtook* me far too closely.", "Ein Lkw *überholte* mich viel zu knapp.", "overtake – overtook – overtaken"],
  ["headwind", "Gegenwind", "n", "B2", "rad", "We rode against a strong *headwind*.", "Wir fuhren gegen starken *Gegenwind*.", "Rückenwind = tailwind"],
  ["endurance", "Ausdauer", "n", "B2", "rad", "Long rides build *endurance*.", "Lange Touren bauen *Ausdauer* auf.", ""],
  ["gradient", "Steigung", "n", "C1", "rad", "The *gradient* reaches twelve per cent near the top.", "Die *Steigung* erreicht oben zwölf Prozent.", ""],
  ["descent", "Abfahrt (bergab)", "n", "C1", "rad", "The *descent* was fast and bumpy.", "Die *Abfahrt* war schnell und holprig.", ""],
  ["chafe", "(wund) scheuern", "v", "C1", "rad", "My shorts started to *chafe*.", "Meine Hose fing an zu *scheuern*.", ""],
  ["exhilarating", "berauschend, mitreißend", "adj", "C1", "rad", "The ride down the mountain was *exhilarating*.", "Die Fahrt den Berg hinunter war *berauschend*.", ""],

  // ---------- Politik & Gesellschaft ----------
  ["recent", "jüngste, kürzlich", "adj", "B1", "politik", "*Recent* events have been quite surprising.", "Die *jüngsten* Ereignisse waren ziemlich überraschend.", ""],
  ["policy", "Richtlinie, (politische) Maßnahme", "n", "B1", "politik", "The new *policy* requires employees to wear badges.", "Die neue *Richtlinie* verpflichtet Mitarbeiter, Ausweise zu tragen.", "policy = konkrete Maßnahme/Richtlinie; politics = Politik allgemein"],
  ["council", "Rat, Stadtrat", "n", "B1", "politik", "The city *council* voted against the plan.", "Der *Stadtrat* stimmte gegen den Plan.", ""],
  ["official", "offiziell", "adj", "B1", "politik", "The *official* announcement was made today.", "Die *offizielle* Ankündigung wurde heute gemacht.", "als Nomen: an official = ein Beamter / Funktionär"],
  ["former", "ehemalig", "adj", "B1", "politik", "Her *former* teacher attended the ceremony.", "Ihr *ehemaliger* Lehrer nahm an der Zeremonie teil.", ""],
  ["campaign", "Kampagne, Wahlkampf", "n", "B1", "politik", "Her *campaign* focused on education.", "Ihr *Wahlkampf* konzentrierte sich auf Bildung.", ""],
  ["establish", "festlegen, gründen, aufbauen", "v", "B2", "politik", "We need to *establish* clear rules.", "Wir müssen klare Regeln *festlegen*.", "establish a company / a rule / contact"],
  ["legislation", "Gesetzgebung", "n", "B2", "politik", "The government introduced new *legislation* on data protection.", "Die Regierung brachte neue *Gesetze* zum Datenschutz ein.", "unzählbar: no \"legislations\""],
  ["controversial", "umstritten", "adj", "B2", "politik", "The decision proved highly *controversial*.", "Die Entscheidung erwies sich als höchst *umstritten*.", ""],
  ["inequality", "Ungleichheit", "n", "B2", "politik", "Rising *inequality* worries many economists.", "Die wachsende *Ungleichheit* beunruhigt viele Ökonomen.", ""],
  ["consensus", "Konsens, Übereinstimmung", "n", "B2", "politik", "The committee finally reached a *consensus*.", "Der Ausschuss erzielte schließlich einen *Konsens*.", "reach a consensus"],
  ["accord", "Abkommen", "n", "C1", "politik", "Opposition groups refused to sign the *accord*.", "Oppositionsgruppen weigerten sich, das *Abkommen* zu unterzeichnen.", "of one's own accord = aus freien Stücken"],
  ["reinforce", "verstärken, bekräftigen", "v", "C1", "politik", "The speech *reinforced* public trust.", "Die Rede *stärkte* das öffentliche Vertrauen.", ""],
  ["advocate", "befürworten, sich einsetzen für", "v", "C1", "politik", "She has long *advocated* free public transport.", "Sie *befürwortet* seit Langem kostenlosen Nahverkehr.", "ohne \"for\": advocate a policy"],
  ["turnout", "Wahlbeteiligung", "n", "C1", "politik", "Voter *turnout* was unusually high.", "Die *Wahlbeteiligung* war ungewöhnlich hoch.", ""],
  ["undermine", "untergraben", "v", "C1", "politik", "Rumours can *undermine* trust in institutions.", "Gerüchte können das Vertrauen in Institutionen *untergraben*.", ""],

  // ---------- Arbeit & Karriere ----------
  ["deadline", "Frist, Abgabetermin", "n", "B1", "arbeit", "We have to meet the *deadline* on Friday.", "Wir müssen die *Frist* am Freitag einhalten.", "meet / miss a deadline"],
  ["overtime", "Überstunden", "n", "B1", "arbeit", "He worked *overtime* all week.", "Er machte die ganze Woche *Überstunden*.", ""],
  ["promote", "befördern; fördern", "v", "B1", "arbeit", "She was *promoted* to team leader.", "Sie wurde zur Teamleiterin *befördert*.", ""],
  ["negotiate", "verhandeln", "v", "B2", "arbeit", "We *negotiated* a better salary.", "Wir *verhandelten* ein besseres Gehalt.", ""],
  ["resign", "kündigen, zurücktreten", "v", "B2", "arbeit", "He *resigned* after ten years at the company.", "Er *kündigte* nach zehn Jahren in der Firma.", "resign from a job / position"],
  ["delegate", "delegieren, übertragen", "v", "B2", "arbeit", "Good managers *delegate* routine tasks.", "Gute Führungskräfte *delegieren* Routineaufgaben.", ""],
  ["workload", "Arbeitspensum", "n", "B2", "arbeit", "My *workload* has doubled this month.", "Mein *Arbeitspensum* hat sich diesen Monat verdoppelt.", ""],
  ["assess", "bewerten, einschätzen", "v", "B2", "arbeit", "We need to *assess* the risks first.", "Wir müssen zuerst die Risiken *einschätzen*.", ""],
  ["requirement", "Anforderung, Voraussetzung", "n", "B2", "arbeit", "Fluent English is a *requirement* for this job.", "Fließendes Englisch ist eine *Voraussetzung* für diesen Job.", ""],
  ["collaborate", "zusammenarbeiten", "v", "B2", "arbeit", "The two teams *collaborated* on the project.", "Die beiden Teams *arbeiteten* an dem Projekt *zusammen*.", "collaborate with someone on something"],
  ["feasible", "machbar, durchführbar", "adj", "C1", "arbeit", "The plan is technically *feasible*.", "Der Plan ist technisch *machbar*.", ""],
  ["streamline", "vereinfachen, straffen", "v", "C1", "arbeit", "We *streamlined* the approval process.", "Wir haben den Genehmigungsprozess *gestrafft*.", ""],
  ["accountable", "verantwortlich, rechenschaftspflichtig", "adj", "C1", "arbeit", "Managers must be held *accountable* for their decisions.", "Manager müssen für ihre Entscheidungen *zur Verantwortung* gezogen werden.", "hold someone accountable"],
  ["incentive", "Anreiz", "n", "C1", "arbeit", "Bonuses are an *incentive* to work harder.", "Boni sind ein *Anreiz*, härter zu arbeiten.", ""],

  // ---------- Wissenschaft & Technik ----------
  ["research", "Forschung", "n", "B1", "wissenschaft", "Her *research* focuses on sleep.", "Ihre *Forschung* konzentriert sich auf den Schlaf.", "unzählbar: no \"researches\""],
  ["device", "Gerät", "n", "B1", "wissenschaft", "Please switch off all electronic *devices*.", "Bitte schalten Sie alle elektronischen *Geräte* aus.", ""],
  ["reliable", "zuverlässig", "adj", "B1", "wissenschaft", "We need *reliable* data.", "Wir brauchen *zuverlässige* Daten.", ""],
  ["evidence", "Beweise, Belege", "n", "B2", "wissenschaft", "There is no *evidence* that it works.", "Es gibt keine *Belege* dafür, dass es funktioniert.", "unzählbar: a piece of evidence"],
  ["conduct", "durchführen", "v", "B2", "wissenschaft", "They *conducted* an experiment on mice.", "Sie *führten* ein Experiment an Mäusen *durch*.", "conduct research / a survey"],
  ["significant", "bedeutend, erheblich", "adj", "B2", "wissenschaft", "The results show a *significant* improvement.", "Die Ergebnisse zeigen eine *erhebliche* Verbesserung.", ""],
  ["breakthrough", "Durchbruch", "n", "B2", "wissenschaft", "The vaccine was a major *breakthrough*.", "Der Impfstoff war ein großer *Durchbruch*.", ""],
  ["outcome", "Ergebnis, Ausgang", "n", "B2", "wissenschaft", "Nobody could predict the *outcome*.", "Niemand konnte den *Ausgang* vorhersagen.", ""],
  ["artificial", "künstlich", "adj", "B2", "wissenschaft", "*Artificial* intelligence is changing many jobs.", "*Künstliche* Intelligenz verändert viele Berufe.", ""],
  ["hypothesis", "Hypothese", "n", "B2", "wissenschaft", "The data supports her *hypothesis*.", "Die Daten stützen ihre *Hypothese*.", "Plural: hypotheses"],
  ["sophisticated", "hochentwickelt, anspruchsvoll", "adj", "C1", "wissenschaft", "The software uses a *sophisticated* algorithm.", "Die Software nutzt einen *hochentwickelten* Algorithmus.", ""],
  ["empirical", "empirisch", "adj", "C1", "wissenschaft", "The theory lacks *empirical* support.", "Der Theorie fehlt die *empirische* Grundlage.", ""],
  ["replicate", "reproduzieren, wiederholen", "v", "C1", "wissenschaft", "Other labs failed to *replicate* the results.", "Andere Labore konnten die Ergebnisse nicht *reproduzieren*.", ""],
  ["inherent", "innewohnend, inhärent", "adj", "C1", "wissenschaft", "Every method has *inherent* limitations.", "Jede Methode hat *inhärente* Grenzen.", "inherent in something"],

  // ---------- Umwelt & Natur ----------
  ["pollution", "Verschmutzung", "n", "B1", "umwelt", "Air *pollution* is a problem in big cities.", "Luft*verschmutzung* ist in Großstädten ein Problem.", ""],
  ["flood", "Überschwemmung, Hochwasser", "n", "B1", "umwelt", "The *flood* destroyed hundreds of homes.", "Das *Hochwasser* zerstörte Hunderte Häuser.", ""],
  ["sustainable", "nachhaltig", "adj", "B2", "umwelt", "We need more *sustainable* farming.", "Wir brauchen eine *nachhaltigere* Landwirtschaft.", ""],
  ["emission", "Ausstoß, Emission", "n", "B2", "umwelt", "The city wants to cut carbon *emissions* by half.", "Die Stadt will den CO₂-*Ausstoß* halbieren.", ""],
  ["drought", "Dürre", "n", "B2", "umwelt", "The *drought* lasted three summers.", "Die *Dürre* dauerte drei Sommer.", "Aussprache: /draʊt/"],
  ["habitat", "Lebensraum", "n", "B2", "umwelt", "The forest is a *habitat* for rare birds.", "Der Wald ist ein *Lebensraum* für seltene Vögel.", ""],
  ["renewable", "erneuerbar", "adj", "B2", "umwelt", "*Renewable* energy is getting cheaper.", "*Erneuerbare* Energie wird billiger.", ""],
  ["extinct", "ausgestorben", "adj", "B2", "umwelt", "Many species are close to becoming *extinct*.", "Viele Arten sind kurz davor, *auszusterben*.", ""],
  ["conservation", "Naturschutz, Erhaltung", "n", "B2", "umwelt", "She works for a wildlife *conservation* group.", "Sie arbeitet für eine *Naturschutz*gruppe.", ""],
  ["vulnerable", "anfällig, verletzlich", "adj", "B2", "umwelt", "Coastal towns are *vulnerable* to storms.", "Küstenstädte sind *anfällig* für Stürme.", ""],
  ["scarce", "knapp, rar", "adj", "C1", "umwelt", "Water is becoming *scarce* in the region.", "Wasser wird in der Region *knapp*.", ""],
  ["deplete", "erschöpfen, aufbrauchen", "v", "C1", "umwelt", "Overfishing has *depleted* fish stocks.", "Überfischung hat die Fischbestände *erschöpft*.", ""],
  ["mitigate", "abmildern, lindern", "v", "C1", "umwelt", "Trees can *mitigate* the effects of heat.", "Bäume können die Folgen von Hitze *abmildern*.", ""],

  // ---------- Gefühle & Beziehungen ----------
  ["grateful", "dankbar", "adj", "B1", "gefuehle", "I'm really *grateful* for your help.", "Ich bin dir wirklich *dankbar* für deine Hilfe.", ""],
  ["embarrassed", "verlegen, peinlich berührt", "adj", "B1", "gefuehle", "He felt *embarrassed* when he forgot her name.", "Es war ihm *peinlich*, als er ihren Namen vergaß.", ""],
  ["frustrated", "frustriert", "adj", "B1", "gefuehle", "She got *frustrated* with the slow internet.", "Sie wurde wegen des langsamen Internets *frustriert*.", ""],
  ["become", "werden", "v", "B1", "gefuehle", "They *became* close friends.", "Sie *wurden* enge Freunde.", "False Friend! become ≠ bekommen (= get / receive)"],
  ["reluctant", "widerwillig, zögerlich", "adj", "B2", "gefuehle", "He was *reluctant* to talk about it.", "Er sprach nur *widerwillig* darüber.", "be reluctant to do something"],
  ["empathy", "Einfühlungsvermögen, Empathie", "n", "B2", "gefuehle", "Good nurses show a lot of *empathy*.", "Gute Pflegekräfte zeigen viel *Einfühlungsvermögen*.", ""],
  ["overwhelmed", "überwältigt, überfordert", "adj", "B2", "gefuehle", "I felt *overwhelmed* by all the emails.", "Ich fühlte mich von all den E-Mails *überfordert*.", ""],
  ["anxious", "besorgt, ängstlich", "adj", "B2", "gefuehle", "She was *anxious* about the exam.", "Sie war wegen der Prüfung *besorgt*.", ""],
  ["sympathetic", "mitfühlend, verständnisvoll", "adj", "B2", "gefuehle", "My boss was very *sympathetic* when I was ill.", "Mein Chef war sehr *verständnisvoll*, als ich krank war.", "False Friend! sympathetic ≠ sympathisch (= likeable / nice)"],
  ["bond", "Bindung, Verbindung", "n", "B2", "gefuehle", "There is a strong *bond* between the sisters.", "Zwischen den Schwestern besteht eine starke *Bindung*.", ""],
  ["resentment", "Groll, Verbitterung", "n", "C1", "gefuehle", "Years of *resentment* finally came out.", "Jahrelanger *Groll* kam endlich zum Vorschein.", ""],
  ["reconcile", "versöhnen; in Einklang bringen", "v", "C1", "gefuehle", "The brothers *reconciled* after years of silence.", "Die Brüder *versöhnten* sich nach Jahren des Schweigens.", "reconcile work and family"],
  ["cherish", "wertschätzen, in Ehren halten", "v", "C1", "gefuehle", "I *cherish* the time we spent together.", "Ich *schätze* die Zeit, die wir zusammen verbracht haben.", ""],
  ["resilient", "widerstandsfähig, belastbar", "adj", "C1", "gefuehle", "Children are often more *resilient* than we think.", "Kinder sind oft *widerstandsfähiger*, als wir denken.", ""],
  ["distraught", "verzweifelt, außer sich", "adj", "C1", "gefuehle", "She was *distraught* after losing her dog.", "Sie war *außer sich*, nachdem sie ihren Hund verloren hatte.", ""],

  // ---------- Medien & Kommunikation ----------
  ["direct", "Regie führen; leiten", "v", "B1", "medien", "Tom will *direct* the play next week.", "Tom wird nächste Woche bei dem Stück *Regie führen*.", "als Adjektiv: direkt"],
  ["headline", "Schlagzeile", "n", "B1", "medien", "The story made *headlines* around the world.", "Die Geschichte machte weltweit *Schlagzeilen*.", ""],
  ["audience", "Publikum, Zuschauer", "n", "B1", "medien", "The *audience* laughed at every joke.", "Das *Publikum* lachte über jeden Witz.", ""],
  ["claim", "behaupten", "v", "B1", "medien", "He *claims* he never saw the email.", "Er *behauptet*, die E-Mail nie gesehen zu haben.", ""],
  ["current", "aktuell, gegenwärtig", "adj", "B1", "medien", "What is the *current* situation?", "Wie ist die *aktuelle* Lage?", "Achtung: actual ≠ aktuell"],
  ["broadcast", "senden, übertragen", "v", "B2", "medien", "The match was *broadcast* live.", "Das Spiel wurde live *übertragen*.", "broadcast – broadcast – broadcast"],
  ["coverage", "Berichterstattung", "n", "B2", "medien", "The election got a lot of media *coverage*.", "Die Wahl bekam viel mediale *Berichterstattung*.", ""],
  ["misleading", "irreführend", "adj", "B2", "medien", "The advert was *misleading*.", "Die Werbung war *irreführend*.", ""],
  ["persuade", "überzeugen, überreden", "v", "B2", "medien", "She *persuaded* me to join the club.", "Sie *überredete* mich, dem Verein beizutreten.", "persuade someone to do something"],
  ["bias", "Voreingenommenheit, Verzerrung", "n", "B2", "medien", "The report shows a clear political *bias*.", "Der Bericht zeigt eine klare politische *Voreingenommenheit*.", ""],
  ["actual", "tatsächlich, eigentlich", "adj", "B2", "medien", "The *actual* cost was much higher.", "Die *tatsächlichen* Kosten waren viel höher.", "False Friend! actual ≠ aktuell (= current)"],
  ["eventually", "schließlich, letztendlich", "adv", "B2", "medien", "We *eventually* found the right answer.", "Wir fanden *schließlich* die richtige Antwort.", "False Friend! eventually ≠ eventuell (= possibly / maybe)"],
  ["convey", "vermitteln, übermitteln", "v", "C1", "medien", "Pictures can *convey* strong emotions.", "Bilder können starke Gefühle *vermitteln*.", ""],
  ["disclose", "offenlegen, preisgeben", "v", "C1", "medien", "The company refused to *disclose* the figures.", "Das Unternehmen weigerte sich, die Zahlen *offenzulegen*.", ""],
  ["allegedly", "angeblich", "adv", "C1", "medien", "The minister *allegedly* lied to parliament.", "Der Minister hat *angeblich* das Parlament belogen.", ""],

  // ---------- Recht & Ordnung ----------
  ["guilty", "schuldig", "adj", "B1", "recht", "The jury found him *guilty*.", "Die Geschworenen befanden ihn für *schuldig*.", "feel guilty = ein schlechtes Gewissen haben"],
  ["suspect", "Verdächtige(r)", "n", "B1", "recht", "Police arrested two *suspects*.", "Die Polizei nahm zwei *Verdächtige* fest.", "Verb: to suspect = vermuten"],
  ["trial", "Prozess, Gerichtsverfahren", "n", "B2", "recht", "The *trial* will begin in May.", "Der *Prozess* beginnt im Mai.", "auch: Test, Versuch (a free trial)"],
  ["witness", "Zeuge, Zeugin", "n", "B2", "recht", "A *witness* saw the car drive away.", "Ein *Zeuge* sah das Auto wegfahren.", ""],
  ["sentence", "Urteil, Strafe", "n", "B2", "recht", "He received a three-year *sentence*.", "Er erhielt eine dreijährige *Strafe*.", "auch: Satz (Grammatik)"],
  ["fraud", "Betrug", "n", "B2", "recht", "She was arrested for tax *fraud*.", "Sie wurde wegen Steuer*betrugs* festgenommen.", ""],
  ["enforce", "durchsetzen", "v", "B2", "recht", "The police must *enforce* the law.", "Die Polizei muss das Gesetz *durchsetzen*.", ""],
  ["comply", "einhalten, befolgen", "v", "C1", "recht", "All products must *comply* with safety rules.", "Alle Produkte müssen die Sicherheitsvorschriften *einhalten*.", "comply with something"],
  ["breach", "Verstoß, Bruch", "n", "C1", "recht", "This is a clear *breach* of contract.", "Das ist ein klarer Vertrags*bruch*.", "data breach = Datenleck"],
  ["liable", "haftbar", "adj", "C1", "recht", "The company is *liable* for any damage.", "Das Unternehmen ist für alle Schäden *haftbar*.", "be liable for something"],
  ["verdict", "Urteil, Urteilsspruch", "n", "C1", "recht", "The jury reached a *verdict* after two days.", "Die Geschworenen fällten nach zwei Tagen ein *Urteil*.", ""],
  ["legitimate", "rechtmäßig, berechtigt", "adj", "C1", "recht", "That's a *legitimate* question.", "Das ist eine *berechtigte* Frage.", ""],

  // ---------- Gesundheit ----------
  ["recover", "sich erholen", "v", "B1", "gesundheit", "It took her weeks to *recover* from the flu.", "Sie brauchte Wochen, um sich von der Grippe zu *erholen*.", "recover from something"],
  ["treatment", "Behandlung", "n", "B1", "gesundheit", "The *treatment* worked well.", "Die *Behandlung* schlug gut an.", ""],
  ["prevent", "verhindern, vorbeugen", "v", "B1", "gesundheit", "Exercise can *prevent* back pain.", "Sport kann Rückenschmerzen *vorbeugen*.", "prevent someone from doing something"],
  ["exhausted", "erschöpft", "adj", "B1", "gesundheit", "I was *exhausted* after the long shift.", "Ich war nach der langen Schicht *erschöpft*.", ""],
  ["prescription", "Rezept (ärztlich)", "n", "B2", "gesundheit", "You need a *prescription* for this medicine.", "Für dieses Medikament brauchst du ein *Rezept*.", "Kochrezept = recipe"],
  ["chronic", "chronisch, dauerhaft", "adj", "B2", "gesundheit", "He suffers from *chronic* back pain.", "Er leidet an *chronischen* Rückenschmerzen.", ""],
  ["diagnose", "diagnostizieren", "v", "B2", "gesundheit", "Doctors *diagnosed* the problem quickly.", "Die Ärzte *diagnostizierten* das Problem schnell.", "Nomen: diagnosis"],
  ["well-being", "Wohlbefinden", "n", "B2", "gesundheit", "Sleep is essential for your *well-being*.", "Schlaf ist wichtig für dein *Wohlbefinden*.", ""],
  ["side effect", "Nebenwirkung", "n", "B2", "gesundheit", "The drug has few *side effects*.", "Das Medikament hat wenige *Nebenwirkungen*.", ""],
  ["contagious", "ansteckend", "adj", "B2", "gesundheit", "Her laughter was *contagious*.", "Ihr Lachen war *ansteckend*.", ""],
  ["sedentary", "sitzend, bewegungsarm", "adj", "C1", "gesundheit", "A *sedentary* lifestyle increases health risks.", "Ein *bewegungsarmer* Lebensstil erhöht Gesundheitsrisiken.", ""],
  ["deteriorate", "sich verschlechtern", "v", "C1", "gesundheit", "His condition *deteriorated* overnight.", "Sein Zustand *verschlechterte* sich über Nacht.", ""],

  // ---------- Wirtschaft & Geld ----------
  ["budget", "Budget, Etat", "n", "B1", "wirtschaft", "We are over *budget* again.", "Wir haben das *Budget* schon wieder überschritten.", ""],
  ["invest", "investieren, anlegen", "v", "B1", "wirtschaft", "He *invested* his savings in property.", "Er *legte* seine Ersparnisse in Immobilien *an*.", "invest in something"],
  ["affordable", "bezahlbar, erschwinglich", "adj", "B1", "wirtschaft", "There is a lack of *affordable* housing.", "Es fehlt an *bezahlbarem* Wohnraum.", ""],
  ["revenue", "Umsatz, Einnahmen", "n", "B2", "wirtschaft", "The company's *revenue* grew by 10%.", "Der *Umsatz* des Unternehmens stieg um 10 %.", ""],
  ["decline", "Rückgang", "n", "B2", "wirtschaft", "There has been a sharp *decline* in sales.", "Es gab einen starken *Rückgang* der Verkäufe.", "Verb: decline = sinken; ablehnen"],
  ["debt", "Schulden", "n", "B2", "wirtschaft", "They paid off all their *debts*.", "Sie zahlten alle ihre *Schulden* ab.", "Aussprache: /det/ – das b ist stumm"],
  ["inflation", "Inflation", "n", "B2", "wirtschaft", "*Inflation* hit its highest level in years.", "Die *Inflation* erreichte den höchsten Stand seit Jahren.", ""],
  ["boost", "ankurbeln, steigern", "v", "B2", "wirtschaft", "Lower taxes could *boost* the economy.", "Niedrigere Steuern könnten die Wirtschaft *ankurbeln*.", ""],
  ["shortage", "Mangel, Knappheit", "n", "B2", "wirtschaft", "There is a *shortage* of nurses.", "Es gibt einen *Mangel* an Pflegekräften.", "a shortage of something"],
  ["fluctuate", "schwanken", "v", "C1", "wirtschaft", "Prices *fluctuate* with the seasons.", "Die Preise *schwanken* je nach Jahreszeit.", ""],
  ["volatile", "unbeständig, sprunghaft", "adj", "C1", "wirtschaft", "The market is extremely *volatile*.", "Der Markt ist extrem *unbeständig*.", ""],
  ["merger", "Fusion, Zusammenschluss", "n", "C1", "wirtschaft", "The *merger* created the largest bank in Europe.", "Die *Fusion* schuf die größte Bank Europas.", ""],
  ["thrive", "gedeihen, florieren", "v", "C1", "wirtschaft", "Small businesses *thrive* in this area.", "Kleine Unternehmen *florieren* in dieser Gegend.", ""],

  // ---------- Argumentieren & Denken ----------
  ["nevertheless", "dennoch, trotzdem", "adv", "B2", "denken", "It was risky; *nevertheless*, we tried.", "Es war riskant; *dennoch* versuchten wir es.", ""],
  ["whereas", "wohingegen, während", "conj", "B2", "denken", "He loves cities, *whereas* she prefers the countryside.", "Er liebt Städte, *wohingegen* sie das Land bevorzugt.", ""],
  ["presumably", "vermutlich", "adv", "B2", "denken", "*Presumably* the train is late again.", "*Vermutlich* hat der Zug wieder Verspätung.", ""],
  ["consequently", "folglich, infolgedessen", "adv", "B2", "denken", "He missed the bus and *consequently* arrived late.", "Er verpasste den Bus und kam *folglich* zu spät.", ""],
  ["assumption", "Annahme", "n", "B2", "denken", "Your *assumption* is wrong.", "Deine *Annahme* ist falsch.", "make an assumption"],
  ["emphasise", "betonen, hervorheben", "v", "B2", "denken", "She *emphasised* the need for change.", "Sie *betonte* die Notwendigkeit von Veränderung.", "US: emphasize"],
  ["contradict", "widersprechen", "v", "B2", "denken", "The two reports *contradict* each other.", "Die beiden Berichte *widersprechen* sich.", ""],
  ["albeit", "wenn auch", "conj", "C1", "denken", "It was a success, *albeit* a small one.", "Es war ein Erfolg, *wenn auch* ein kleiner.", "formell, meist vor Adjektiv/Nomen"],
  ["notwithstanding", "ungeachtet, trotz", "prep", "C1", "denken", "*Notwithstanding* the rain, the event went ahead.", "*Ungeachtet* des Regens fand die Veranstaltung statt.", "sehr formell"],
  ["implication", "Auswirkung, Folge; Andeutung", "n", "C1", "denken", "We must consider the *implications* of this decision.", "Wir müssen die *Auswirkungen* dieser Entscheidung bedenken.", ""],
  ["ambiguous", "mehrdeutig, unklar", "adj", "C1", "denken", "The instructions were *ambiguous*.", "Die Anweisungen waren *mehrdeutig*.", ""],
  ["coherent", "schlüssig, zusammenhängend", "adj", "C1", "denken", "She gave a clear and *coherent* argument.", "Sie lieferte ein klares und *schlüssiges* Argument.", ""],
  ["acknowledge", "anerkennen, zugeben", "v", "C1", "denken", "He *acknowledged* that he had made a mistake.", "Er *gab zu*, dass er einen Fehler gemacht hatte.", ""],
  ["nuance", "Nuance, Feinheit", "n", "C1", "denken", "Translation often loses *nuance*.", "Beim Übersetzen gehen oft *Feinheiten* verloren.", ""],
  ["plausible", "plausibel, glaubhaft", "adj", "C1", "denken", "That's a *plausible* explanation.", "Das ist eine *plausible* Erklärung.", ""],
];

export function slug(en) {
  return en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function seedCards() {
  // Startliste + großer Wortschatz (wordbank.js), doppelte Wörter nur einmal.
  // Reihenfolge: Niveau aufsteigend, innerhalb des Niveaus nach Thema gebündelt.
  const seen = new Set();
  const rows = [];
  for (const r of [...RAW, ...WORDBANK]) {
    const id = slug(r[0]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push(r);
  }
  const order = Object.keys(TOPICS);
  const sorted = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const l = LEVELS.indexOf(a.r[3]) - LEVELS.indexOf(b.r[3]);
      if (l) return l;
      const t = order.indexOf(a.r[4]) - order.indexOf(b.r[4]);
      return t || a.i - b.i;
    })
    .map((x) => x.r);
  return sorted.map((r, i) => ({
    id: "w-" + slug(r[0]),
    en: r[0],
    de: r[1],
    pos: r[2],
    level: r[3],
    topic: r[4],
    ex: r[5],
    exDe: r[6],
    note: r[7] || "",
    order: i,
    state: "new",
    custom: false,
  }));
}
