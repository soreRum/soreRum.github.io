## REvil Ransomware Investigation -- Splunk (Sysmon Logs)

------------------------------------------------------------------------

### Q1 --- Identify the ransom note filename

**Splunk Query:** `index="revil" event.code=11 winlog.event_data.TargetFilename="*.txt*"`

**Relevant Event:**
-   Sysmon Event ID: **11 (FileCreate)**
-   Timestamp: `2023-09-07T16:10:14.827Z`

**Target Filename:** `C:\Users\Public\Videos\5uizv5660t-readme.txt` <- **ransom note**

**Process Responsible:** 
- `Image: `C:\Users\Administrator\Downloads\facebook assistant.exe``
- PID: **5348**

------------------------------------------------------------------------

### Q2 --- Identify the ransomware process ID

**Splunk Query:** `index="revil" event.code=1 earliest="09/07/2023:16:00:00" latest="09/07/2023:16:15:00" winlog.event_data.ParentCommandLine="*facebook*"`

**Relevant Process Information:**
-   OriginalFileName: **PowerShell.EXE**
-   ProcessId: **1860**
-   ParentImage:
    `C:\Users\Administrator\Downloads\facebook assistant.exe`
-   ParentProcessId: **5348** <- **ransomware PID**

**Comment:** facebook assistant spawning a child PS process to do what?


------------------------------------------------------------------------

### Q3 --- Locate the ransomware executable

**Splunk Query:** `index="revil" event.code=1 winlog.event_data.CommandLine="*facebook*"`

**Result:**
-   CommandLine:
    `"C:\Users\Administrator\Downloads\facebook assistant.exe"`
-   Image: `C:\Users\Administrator\Downloads\facebook assistant.exe` <- **located**
-   ProcessId: **5348**
-   ParentImage: `C:\Windows\explorer.exe`
-   ParentProcessId: **244**

**Execution Chain so far:** `explorer.exe (PID 244) -> facebook assistant.exe (PID 5348) -> PowerShell.exe (PID 1860)`


------------------------------------------------------------------------

### Q4 --- Command used to disrupt system recovery

**Suspicious PowerShell Command**: `powershell -e RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFMAaABhAGQAbwB3AGMAbwBwAHkAIAB8ACAARgBvAHIARQBhAGMAaAAtAE8AYgBqAGUAYwB0ACAAewAkAF8ALgBEAGUAbABlAHQAZQAoACkAOwB9AA==`

**Decoded Command:** `Get-WmiObject Win32_Shadowcopy | ForEach-Object {$_.Delete();}`


------------------------------------------------------------------------

### Final Attack Chain

`explorer.exe (PID 244) -> facebook assistant.exe (PID 5348) -> PowerShell.exe (PID 1860) -> clears logs -> deletes shadow copies -> creates ransom note C:\Users\Public\Videos\5uizv5660t-readme.txt`

------------------------------------------------------------------------

### IOCs

- **Malicious Executable**: `C:\Users\Administrator\Downloads\facebook assistant.exe`
- **Ransom Note:** `C:\Users\Public\Videos\5uizv5660t-readme.txt`
- **Suspicious PowerShell Activity:** `Get-WmiObject Win32_Shadowcopy | ForEach-Object {$_.Delete();}`
- **Log Clearing Activity:** `wevtutil.exe cl "Windows PowerShell"`

