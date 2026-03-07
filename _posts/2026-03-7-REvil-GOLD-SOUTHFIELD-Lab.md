# REvil Ransomware Investigation -- Splunk (Sysmon Logs)

## Objective

Investigate a ransomware infection affecting a Windows machine using
**Sysmon logs in Splunk** to determine: - Ransom note filename -
Ransomware process ID - Executable location - Commands used to disrupt
recovery

------------------------------------------------------------------------

# Q1 --- Identify the ransom note filename

## Splunk Query

    index="revil" event.code=11 winlog.event_data.TargetFilename="*.txt*"

## Relevant Event

-   **Sysmon Event ID:** 11 (FileCreate)
-   **Timestamp:** `2023-09-07T16:10:14.827Z`

### Target Filename

    C:\Users\Public\Videos\5uizv5660t-readme.txt

### Process responsible

    Image: C:\Users\Administrator\Downloads\facebook assistant.exe
    PID: 5348

## Conclusion

The ransomware created the ransom note:

    5uizv5660t-readme.txt

------------------------------------------------------------------------

# Q2 --- Identify the ransomware process ID

## Splunk Query

    index="revil" event.code=1 earliest="09/07/2023:16:00:00" latest="09/07/2023:16:15:00" winlog.event_data.ParentCommandLine="*facebook*"

## Relevant Process Information

  -----------------------------------------------------------------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------------------------------------------------------------
  OriginalFileName                    PowerShell.EXE

  ProcessId                           1860

  ParentImage                         C:`\Users`{=tex}`\Administrator`{=tex}`\Downloads`{=tex}`\facebook `{=tex}assistant.exe

  ParentProcessId                     **5348**
  -----------------------------------------------------------------------------------------------------------------------------

## Interpretation

PowerShell was launched by the ransomware executable.

### Ransomware PID

    5348

------------------------------------------------------------------------

# Q3 --- Locate the ransomware executable

## Splunk Query

    index="revil" event.code=1 winlog.event_data.CommandLine="*facebook*"

## Result

  -------------------------------------------------------------------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -------------------------------------------------------------------------------------------
  CommandLine                         "C:`\Users`{=tex}`\Administrator`{=tex}`\Downloads`{=tex}`\facebook `{=tex}assistant.exe"

  Image                               C:`\Users`{=tex}`\Administrator`{=tex}`\Downloads`{=tex}`\facebook `{=tex}assistant.exe

  ProcessId                           5348

  ParentImage                         C:`\Windows`{=tex}`\explorer`{=tex}.exe

  ParentProcessId                     244
  -------------------------------------------------------------------------------------------------------------------------------

## Execution Chain

    explorer.exe (PID 244)
            ↓
    facebook assistant.exe (PID 5348)
            ↓
    PowerShell.exe (PID 1860)

## Conclusion

The ransomware executable is located at:

    C:\Users\Administrator\Downloads\facebook assistant.exe

This suggests the malware was likely executed after being downloaded by
the user.

------------------------------------------------------------------------

# Q4 --- Command used to disrupt system recovery

Ransomware commonly deletes **Volume Shadow Copies** to prevent
recovery.

## Suspicious PowerShell Command

    powershell -e RwBlAHQALQBXAG0AaQBPAGIAagBlAGMAdAAgAFcAaQBuADMAMgBfAFMAaABhAGQAbwB3AGMAbwBwAHkAIAB8ACAARgBvAHIARQBhAGMAaAAtAE8AYgBqAGUAYwB0ACAAewAkAF8ALgBEAGUAbABlAHQAZQAoACkAOwB9AA==

## Decoded Command

    Get-WmiObject Win32_Shadowcopy | ForEach-Object {$_.Delete();}

### Purpose

Deletes Windows **Volume Shadow Copies**, preventing file recovery.

------------------------------------------------------------------------

# Timeline of Attack

    16:09:28  wevtutil.exe cl "Windows PowerShell"  → clears logs
    16:09:53  Shadow copies deleted
    16:10:14  Ransom note created

------------------------------------------------------------------------

# Final Attack Chain

    Explorer launches executable
            ↓
    facebook assistant.exe (PID 5348)
            ↓
    PowerShell.exe (PID 1860)
            ↓
    Clears PowerShell logs
            ↓
    Deletes shadow copies
            ↓
    Creates ransom note
    C:\Users\Public\Videos\5uizv5660t-readme.txt

------------------------------------------------------------------------

# Key Indicators of Compromise (IOCs)

## Malicious Executable

    C:\Users\Administrator\Downloads\facebook assistant.exe

## Ransom Note

    C:\Users\Public\Videos\5uizv5660t-readme.txt

## Suspicious PowerShell Activity

    Get-WmiObject Win32_Shadowcopy | ForEach-Object {$_.Delete();}

## Log Clearing

    wevtutil.exe cl "Windows PowerShell"
