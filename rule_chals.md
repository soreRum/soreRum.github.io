## suricata chal: Detect Telegram API connection Activity
- **goal:** Create a rule that will detect the packets related to the telegram API communication.

**rule:** `alert tls any any -> any any (msg:"Detected Telegram API connection Activity -- via Client Hello"; flow:to_server; tls.sni; content:"api.telegram.org"; nocase; sid:100001; rev:1;)`

**Thoughts:** It’s as simple as targeting tls.sni, the Server Name Indication. I originally included the JA3 hash, but realized that it wasn’t helpful for detecting Telegram connection activity. JA3 fingerprints the client TLS handshake, not the destination (api.telegram.org). Adding a JA3 hash for detection would focus on the TLS client implementation rather than Telegram API traffic itself. JA3 is more useful when detecting unusual client behavior, malware-y stuff, where the TLS fingerprint is unique enough to identify a specific malicious tool or a specific TLS client implementation.

- ja3 == destination-independant
- SNI == more direct and reliable indicator

The chal expected detection of 12 packets:

![telegram_rule](./images/telegram_rule.png)



## suricata chal: Identify Speech Recognition Chrome Extension Payload in Network Traffic
- **goal:** Analyze the captured traffic and determine whether a Chrome extension payload is being transferred. Focus on response content that reveals the extension’s manifest and embedded DLL components, and write a Suricata rule that detects this artifact reliably without relying on IPs or ports.

- **rule:** '------'

**Thoughts:** I wanted to build context before creating this rule. I followed the HTTP/TCP stream and found a stream where some bits of the manifest.json file showed up within the transferred bytes, including the string "name": "Speech Recognition". The host string (`msedge.b.tlu.dl.delivery.mp.microsoft.com`) appears to be a Microsoft Edge CDN endpoint, specifically a download delivery mechanism for Microsoft-specific content such as extensions or update packages. Here is the full request example I am analyzing:

`GET /filestreamingservice/files/2132f61f-f790-4ae6-a355-8cf9a1533800?P1=1757185982&P2=404&P3=2&P4=c1pT928%2fcNpn%2bhiPV%2feDJwgcmMghYDFStIXCZMBx0quHbu8wHa63x0JtAf%2fkqoVZhaG0phaVZr5%2fmgTnCtpSRw%3d%3d HTTP/1.1`

**filestreamingservice** appears to be a backend service route, **files** the resource type, and **2132f61f-f790-4ae6-a355-8cf9a1533800** likely a file identifier understood by the backend (the extension payload itself?). The query parameters (P1–P4) appears to be part of a tokenized or crypto signed download request, since P4 looks to be a base-64 encoded sig component. 

The HTTP response content type is `application/x-chrome-extension`, and the transfer uses a byte range request:

Range: `bytes=1120-2460`

The 206 Partial Content response code signals a chunked transfer. (appears to be how BITS handles its download operations?)

The HTTP stream shows binary data containing PK markers along with embedded strings such as manifest.json and Microsoft.CognitiveServices.Speech.core.dll, which signals a ZIP/CRX-style archive containing an extension package. Here it is: `S.s..........
._...>..N......h.PK..
.......hT....L...L...
...manifest.json{"manifest_version": 2,"name": "Speech Recognition","version": "1.15.0.1"}
PK..........hT...,....H.).+...Microsoft.CognitiveServices.Speech.core.dll.]wxT....B6.......d.	5..@P.....H..X.P...i!.fY.
"..O.`

So with all this http stream data collected, Im going to assume this is a microsoft-signed CDN delivery of a browser extension package hinting to be the chrome speech recognition exetension payload being transferred in chunks via BITS.(Background Intelligent Transfer Service). I picked this up from the user-agent btw: `User-Agent: Microsoft BITS/7.8`

Part 1 of the goal was confirmed -> "Analyze the captured traffic and determine whether a Chrome extension payload is being transferred."
Part 2 of the goal is now to -> "write a Suricata rule that detects this artifact reliably"

What am I going to target in this rule? the http.response_header and file.data aka the http.response_body
- `Content-Type: "application/x-chrome-extension"` 
- `"manifest.json"`
- `"manifest_version": 2` 
- `"name": "Speech Recognition"` 
- `Microsoft.CognitiveServices.Speech.core.dll` 
- the version is not appropiate here because when the extension version changes, this rule goes down the toilet.
