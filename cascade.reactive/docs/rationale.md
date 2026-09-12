:bulb: FYI: Jag tror jag kom på den ultimata arkitekturen för att bygga en WYSIWYG ordbehandlare i somras. Att rendera ett dokument följer ju ofta visitor-pattern. Man itererar över ett dokument och samtidigt håller reda på ett renderings-tillstånd. Tillståndet kan vara en sekvens med papper och positionerad text som modifieras gradvis. Problemet är att vid WYSIWYG så måste man göra om detta reaktivt när minsta lilla ändring sker, utan att behöva generera om hela dokumentet. Så för att bygga en WYSIWYG måste man sätta upp eventhantering, skriva kod som kan göra om valda delar av renderingen samt hantera alla subtila beroenden mellan olika delar av renderingen etc. Detta slutar lätt i kaos. 

Men om man istället bygger en arkitektur där det är lika lätt att bygga WYSIWYG som det är att bara transformera ett dokument till att börja med? 

Med "reaktiv auto-beroende pipeline" kan man låta varje komponent i renderingen fritt manipulera tillståndet, medan ett underliggande system automatiskt och i realtid spelar in vad som läses och vad som skrivs av varje komponent. Varje komponent ser också tillståndet, som det ser ut vid dess position i renderingen (tillståndet är i princip versionshanterat). När något då sedan ändras, så kan man med kirurgisk precision invalidera bara just de komponenter som berörs, och sedan köra om bara dessa. 

Med JSProxies under huven så kan man också bygga detta renderingstillstånd hur man vill med vanliga Javascript/Typescript klasser, så länge man wrappar alla objekt med ett observeable() anrop.  

Detta är i samma anda som anda auto-observe system som MobX t.ex., med den viktiga skillnaden att repeaters är sorterade efter när de körs i en "pipeline", och observeable objekt har en tidslinje och versionshanteras över denna tidslinje. Det är möjligt att detta är en helt unik idé för att hantera reaktivitet.

Så tanken är att man då får en arkitektur som är extremt lätt att underhålla, och där koden till en interaktiv och optimerad editor, ser ut precis som en vanlig dokument-transformation med bara visitor-pattern. 

Så om vi någon gång tröttnar på TinyMCE eller vill bygga ett annat interaktivt transformeringsverktyg av något slag, så finns det idéer om hur man kan göra.
