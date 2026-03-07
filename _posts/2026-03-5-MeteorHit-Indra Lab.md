## MeteorHit - Indra Lab on CyberDefenders

**Goal:** Reconstruct a wiper malware attack by analyzing registry, event logs, and USN journal artifacts using Registry Explorer, Event Log Explorer, and VirusTotal.

Initial investigations reveal that attackers compromised the Active Directory (AD) system and deployed wiper malware across multiple machines. You have been provided with forensic artifacts collected via KAPE SANS Triage from one of the affected machines to determine how the attackers gained access, the scope of the malware's deployment, and what critical systems or data were impacted before the shutdown

**The artifacts I moved between during this investigation:** Registry, USN, MFT, Sysmon, VirusTotal

**The malware behavior identified during this investigation:** GPO propagation, archive staging, AV evasion, scheduled execution, domain removal, boot destruction, screen locker

Building the mental model, the attack chain:
--------------------------------------------
I need to understand what GPOs are and how they can be abused to eventually answer this first question

Q1: `The attack began with using a Group Policy Object (GPO) to execute a malicious batch file. What is the name of the malicious GPO responsible for initiating the attack by running a script?`

about the abuse
- either a domain account or an Active Directory user account with delegated permissions that has permission to create/modify a Group Policy object in Active Directory
- the compromised account having edit rights on a GPO → can add startup scripts, scheduled tasks, registry changes, malicious software, etc.
- the policy files for a GPO live in the SYSVOL directory. note: SYSVOL replicates between domain controllers, so any change spreads across them. If an attacker inserts a malicious script into the policy configuration, it becomes part of the GPO.
- eventually the domain computers will refresh group policy (about every 90 minutes, or after a reboot, login, or a manual gpupdate), and the modified GPO will be applied to the systems where that policy is linked.
- then once update goes into effect, malicious script or config executes allowing for code execution/persistence across the domain computers that receive that GPO

about GPO: GPOs have access controls associated  with them and are centrally managed in Active Directory. They are used  to manage security and operational settings across domain systems. GPOs  can handle settings such as: password and account lockout policies, security configurations such as firewall rules and audit policies, software deployment and updates, desktop and user environment restrictions, logon and logoff scripts, system and application configuration settings

The KAPE artifact structure shows filesystem artifacts (filesystem triage collection) pulled from the root of C: so this drive structure was reconstructed. The GPO ran the script so two things can be covered: the script itself, a file and the config that instructs the OS to run the script

instructions on the config part: What script to run, when to run it, where the script is located. without this, how would the OS know to execute it?
find GPO configs that have the instructions to execute scripts, prob at startup since this is a code exec/persist method: the registry hives?

which reg hive or hives would point me to this GPO config data for this machine within this reconstructed C:/ drive? SYSTEM, SECURITY, SOFTWARE, SAM?
Searching the SOFTWARE hive to pull out this config metadata: script name, its path and the GPO name executing this script at startup.....

I searched for .bat and came across the script and the script location but I still need to find the GPO that deployed this

- script name: `\\WIN-499DAFSKAR7\Data\scripts\setup.bat` -- network location?
- script location: `Microsoft\Windows\CurrentVersion\Group Policy\Scripts\Startup\0\0` and `Microsoft\Windows\CurrentVersion\Group Policy\State\Machine\Scripts\Startup\0\0`

So its storing GPO script data in `Group Policy\Scripts` for config and `Group Policy\State` for policy state tracking

I went to browse that path within the same SOFTWARE hive (the metadata for the group policy) -> `Microsoft\Windows\CurrentVersion\Group Policy\Scripts\Startup\0`
and found the GPO name that deployed the config and executed this script.bat. Its **"DeploySetup"** and looking at the PSScriptOrder set to 1, the setup.bat file is the first startup script executed. This GPO lives in SYSVOL which makes sense since thats the domain-wide share folder where GPO files are stored. 

so far: Registry → Policy Metadata → GPO Name

Q2: `During the investigation, a specific file containing critical components necessary for the later stages of the attack was found on the system. This file, expanded using a built-in tool, played a crucial role in staging the malware. What is the name of the file, and where was it located on the system? Please provide the full file path`

So my thinking is finding a file that the attacker(s) placed on the machine that needs to be expanded to deploy multiple components for the later stages of the attack. I’m dealing with file activity behavior, and I have these filesystem artifacts that can be useful in uncovering the full file name and full path on disk. The main artifact focus here is the USN Journal ($J). The USN Journal records file system activity, including:
- files created
- files modified
- files renamed
- files deleted

This artifact can help identify when a file appeared on disk or when bursts of file activity occurred, which could indicate archive extraction or malware staging activity. The tool used to analyze the USN Journal is MFTECmd. Using the USN Journal output, I can look for file activity around the timeline of the malicious GPO execution, since the startup script deployed through the GPO likely triggered the staging process shortly afterward. Earlier in the investigation, the GPO policy responsible for executing the malicious script had a last write timestamp of 16:04:11, so I focused on file activity occurring shortly after that time. By sorting and filtering the USN Journal output around that timeframe, I was able to identify suspicious file activity beginning around 16:04:16, which closely correlates with the policy execution timeline. The USN entries for env.cab show a sequence of operations such as FileCreate, DataExtend, DataOverwrite, and BasicInfoChange, which indicates the file was created and written to disk at that time. This sequence of events typically occurs when a file is first created and its contents are written by a process. Later USN entries for the same file show additional activity such as DataOverwrite and FileDelete, indicating the file was modified and eventually deleted around 16:08:35. This behavior is consistent with a temporary staging file, where an archive is written to disk, its contents are extracted, and the archive is removed afterward. The USN Journal output typically does not contain the full file path, because it references files using File Reference Numbers (FRN) rather than directory paths. In the USN output, env.cab was associated with File Reference Number 97892 and Parent FRN 97053. To resolve the full location of the file, I pivoted to the $MFT output, which maps those file reference numbers to their actual directory structure. Looking up FRN 97892 in the $MFT output revealed an entry showing the directory path .\ProgramData\Microsoft\env with the file name env.cab. Reconstructing this directory with the system drive results in the full file path: `C:\ProgramData\Microsoft\env\env.cab` The timestamps in the $MFT entry also matched the behavior observed in the USN Journal, showing the file being created at 16:04:16 and later modified and removed around 16:08:35, further confirming the file’s role as a temporary staging archive during the attack. Following this process revealed the container file used in the staging phase of the attack, located at: `C:\ProgramData\Microsoft\env\env.cab` This CAB file is a Microsoft archive format used to compress and bundle multiple files into a single container. In this case, the env.cab file acts as a staging container that houses additional files required for later stages of the attack. Further analysis of the system logs revealed that this archive was extracted using the built-in Windows utility expand.exe, as shown in the command: `expand "C:\ProgramData\Microsoft\env\env.cab" /F:* "C:\ProgramData\Microsoft\env"` This command extracts all files contained in the CAB archive into the same directory, confirming that the attacker used a native Windows tool to expand the archive as part of the staging process. Using a .cab archive provides several advantages for attackers. It allows them to package multiple components together, reduce file size through compression, and avoid dropping many suspicious files onto the system at once. It also enables the use of Living-off-the-Land (LoTL) techniques, since Windows includes built-in utilities capable of expanding CAB archives, allowing attackers to extract staged components without introducing additional tools onto the system. After the archive was expanded, additional files such as bcd.rar appeared in the filesystem timeline shortly afterward, suggesting that env.cab contained another archive which was written to disk during extraction.

So far the attack chain (mental model) looks like this:
- Registry artifacts → malicious GPO identified (DeploySetup)
- GPO startup script → setup.bat execution
- USN Journal → env.cab staged on disk
- $MFT → reconstruct path (C:\ProgramData\Microsoft\env\env.cab)
- CAB archive expanded using built-in Windows utility (expand.exe)
- RAR archive (programs.rar) written to disk from env.cab
- RAR archive extracted using password-protected command
- Malware components deployed — this is where Q3 comes in
- archive overwritten and deleted to remove staging artifacts (env.cab)

Q3: `The attacker employed password-protected archives to conceal malicious files, making it important to uncover the password used for extraction. Identifying this password is key to accessing the contents and analyzing the attack further. What is the password used to extract the malicious files?`

So first thing I wanted to do was analyze what events took place after the first six file operations associated with env.cab in the USN Journal. Since env.cab appeared to act as a staging archive, I wanted to see if any additional files were dropped shortly afterward that could represent the next stage in the attack. Shortly after the env.cab activity, I observed the creation of bcd.rar in the USN Journal at around 16:04:17. The USN entries showed file operations such as FileCreate, DataOverwrite, DataExtend, and IndexableChange, which indicates that the file was created and written to disk during that time window. Since the challenge states that the attacker used password-protected archives to conceal malicious files, the presence of bcd.rar, a RAR archive, stood out as a likely candidate. RAR archives commonly support password protection, making them a practical method for attackers to hide payloads from casual inspection. At this point, the goal becomes determining how bcd.rar was extracted and identifying the password used during that extraction. Archive extraction tools such as RAR or 7-Zip accept passwords through command-line arguments, and when these tools execute on a system, the process creation logs can capture those command-line arguments. So, the next step is to examine process creation events in the system logs to identify the extraction tool that executed bcd.rar and determine the password that was supplied as a command-line argument during extraction. Upon reviewing the process execution logs, I identified a command that executed the RAR extraction utility, which showed the following command line: `"Rar.exe" x "C:\ProgramData\Microsoft\env\programs.rar" -phackemall` This command indicates that Rar.exe was used to extract the archive located in the staging directory. The x parameter instructs the tool to extract the archive with its directory structure, while the -p flag specifies the password used to unlock the archive. From this command-line argument, it can be determined that the password used to extract the malicious archive was: **hackemall**. This confirms that the attacker used a password-protected RAR archive as an additional layer of obfuscation, requiring the correct password to extract and deploy the malware components during the later stages of the attack.

So far the attack chain (mental model) looks like this:
- Registry artifacts → malicious GPO identified (DeploySetup)
- GPO startup script → setup.bat execution
- USN Journal → env.cab staged on disk
- $MFT → reconstruct path (C:\ProgramData\Microsoft\env\env.cab)
- CAB archive expanded using built-in Windows utility (expand.exe)
- RAR archive (programs.rar) written to disk from env.cab
- RAR archive extracted using Rar.exe with password supplied via command-line argument (-phackemall)
- Malware components deployed — password used to extract archive: hackemall
- archive overwritten and deleted to remove staging artifacts (env.cab)

Q4: `Several commands were executed to add exclusions to Windows Defender, preventing it from scanning specific files. This behavior is commonly used by attackers to ensure that malicious files are not detected by the system's built-in antivirus. Tracking these exclusion commands is crucial for identifying which files have been protected from antivirus scans. What is the name of the first file added to the Windows Defender exclusion list?`

Still in sysmon checking Event ID 1 logs. First AV like query spotted was a recon check for a specific security software, Kaspersky -> `reg query "HKLM\SOFTWARE\KasperskyLab"` still under the working directory C:\ProgramData\Microsoft\env with the parent process still being setup.bat. If kaspersky was present, the malware wouldve taken a different route depending on its capabilities/tradecraft. Right after this reg query, a Windows Defender exclusion command was spotted. Here is the CommandLine -> `powershell -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\update.bat'"` Add-MpPreference is a PS cmdlet used to modify Windows Defender settings, -ExclusionPath adds a file exclusion in this case but also directories, update.bat is the file being excluded and -Force will suppress prompts. 

So far the attack chain (mental model) looks like this:
- Registry artifacts → malicious GPO identified (DeploySetup)
- GPO startup script → setup.bat execution
- USN Journal → env.cab staged on disk
- $MFT → reconstruct path (C:\ProgramData\Microsoft\env\env.cab)
- CAB archive expanded using built-in Windows utility (expand.exe)
- RAR archive (programs.rar) written to disk from env.cab
- RAR archive extracted using Rar.exe with password supplied via command-line argument (-phackemall)
- Malware components deployed — password used to extract archive: hackemall
- Attacker checks for presence of other antivirus software → reg query "HKLM\SOFTWARE\KasperskyLab"
- Windows Defender exclusion added using PowerShell → Add-MpPreference -Force -ExclusionPath "C:\ProgramData\Microsoft\env\update.bat"
- First file added to Windows Defender exclusion list → update.bat
- archive overwritten and deleted to remove staging artifacts (env.cab) 

Q5: `A scheduled task has been configured to execute a file after a set delay. Understanding this delay is important for investigating the timing of potential malicious activity. How many seconds after the task creation time is it scheduled to run?`

looking for schtasks.exe, powershell/wmi usage for scheduled tasks.
```
CommandLine: C:\Windows\system32\cmd.exe /c powershell -command "(Get-Date).AddMinutes(3.5).ToString('HH:mm:ss')"
CurrentDirectory: C:\ProgramData\Microsoft\env\

OriginalFileName: schtasks.exe
CommandLine: schtasks  /CREATE /SC ONCE /ST 09:08:13 /TN "mstask" /RL HIGHEST /RU SYSTEM /TR "\""C:\ProgramData\Microsoft\env\env.exe"\" C:\temp\msconf.conf"
```
This is the scheduled task named mstask, how convienent ("ms" prefix) that runs once at a specified start time, in this case 3.5 minutes (210 seconds) post creation. (most likely delayed for evasion purposes) This taks is configured to execute with SYSTEM privs and the highest run level, so the payload can run with elevated perms. The command before the scheduled tasks creation was used to take the current system time, add 3.5 minutes to it, format the result as a timestamp to then be used as the scheduled task start time. 

So far the attack chain (mental model) looks like this:
- Registry artifacts → malicious GPO identified (DeploySetup)
- GPO startup script → setup.bat execution
- USN Journal → env.cab staged on disk
- $MFT → reconstruct path (C:\ProgramData\Microsoft\env\env.cab)
- CAB archive expanded using built-in Windows utility (expand.exe)
- RAR archive (programs.rar) written to disk from env.cab
- RAR archive extracted using Rar.exe with password supplied via command-line argument (-phackemall)
- Malware components deployed — password used to extract archive: hackemall
- Attacker checks for presence of other antivirus software → reg query "HKLM\SOFTWARE\KasperskyLab"
- Windows Defender exclusion added using PowerShell → Add-MpPreference -Force -ExclusionPath "C:\ProgramData\Microsoft\env\update.bat"
- First file added to Windows Defender exclusion list → update.bat
- Scheduled task created using schtasks.exe → task name mstask configured to execute C:\ProgramData\Microsoft\env\env.exe
- Scheduled task execution delay calculated using PowerShell → (Get-Date).AddMinutes(3.5)
- Payload execution scheduled 210 seconds after task creation time
- archive overwritten and deleted to remove staging artifacts (env.cab)

Q6: `After the malware execution, the wmic utility was used to unjoin the computer system from a domain or workgroup. Tracking this operation is essential for identifying system reconfigurations or unauthorized changes. What is the Process ID (PID) of the utility responsible for performing this action?`

So Im guessing the scheduled task, env.exe + custom ms config file will fire once 3.5 minutes hit and itll execute this wmic utility to unjoin the computer system from a domain or workgroup.
```
CommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
CurrentDirectory: C:\Windows\system32\

ParentCommandLine: C:\Windows\system32\svchost.exe -k netsvcs -p -s Schedule
ParentUser: NT AUTHORITY\SYSTEM
```
The scheduled task fired and now
```
CommandLine: C:\Windows\System32\cmd.exe /c wmic computersystem where name="%%computername%%" call unjoindomainorworkgroup
CurrentDirectory: C:\Windows\system32\

ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
wmic is removing a computer system from a domain or workgroup. And what might that computer system be?
```
ProcessId: 7492
CommandLine: wmic  computersystem where name="DESKTOP-VBIOB4B" call unjoindomainorworkgroup
CurrentDirectory: C:\Windows\system32\
```
Its DESKTOP-VBIOB4B. The PID of wmic that performed this action is 7492.

So far the attack chain (mental model) looks like this:
- Registry artifacts → malicious GPO identified (DeploySetup)
- GPO startup script → setup.bat execution
- USN Journal → env.cab staged on disk
- $MFT → reconstruct path (C:\ProgramData\Microsoft\env\env.cab)
- CAB archive expanded using built-in Windows utility (expand.exe)
- RAR archive (programs.rar) written to disk from env.cab
- RAR archive extracted using Rar.exe with password supplied via command-line argument (-phackemall)
- Malware components deployed — password used to extract archive: hackemall
- Attacker checks for presence of other antivirus software → reg query "HKLM\SOFTWARE\KasperskyLab"
- Windows Defender exclusion added using PowerShell → Add-MpPreference -Force -ExclusionPath "C:\ProgramData\Microsoft\env\update.bat"
- First file added to Windows Defender exclusion list → update.bat
- Scheduled task created using schtasks.exe → task name mstask configured to execute C:\ProgramData\Microsoft\env\env.exe
- Scheduled task execution delay calculated using PowerShell → (Get-Date).AddMinutes(3.5)
- Payload execution scheduled 210 seconds after task creation time
- Scheduled task executed by Task Scheduler service (svchost.exe -k netsvcs -s Schedule) → env.exe launched with configuration file C:\temp\msconf.conf
- Payload executes system reconfiguration command → wmic computersystem call unjoindomainorworkgroup
- WMIC process removes system from domain → Process ID (PID): 7492
- archive overwritten and deleted to remove staging artifacts (env.cab)

Q7: `The malware executed a command to delete the Windows Boot Manager, a critical component responsible for loading the operating system during startup. This action can render the system unbootable, leading to serious operational disruptions and making recovery more difficult. What command did the malware use to delete the Windows Boot Manager?`

After the WMIC domain unjoin operation, the payload env.exe executed with the configuration file msconf.conf continues its destructive actions. The malware then leverages the bcdedit.exe utility, which is used to manage the Boot Configuration Data (BCD) store, a critical component responsible for loading the operating system during startup.

The first command executed was:
```
CommandLine: C:\Windows\System32\cmd.exe /c C:\Windows\Sysnative\bcdedit.exe -v
CurrentDirectory: C:\Windows\system32\

ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
The -v option instructs bcdedit to display all identifiers in full, which allows the malware to enumerate the GUIDs associated with boot entries in the BCD store, including the Windows Boot Manager. Once these identifiers are discovered, the malware proceeds to delete them using the following commands:
```
CommandLine: C:\Windows\System32\cmd.exe /c C:\Windows\Sysnative\bcdedit.exe /delete {9dea862c-5cdd-4e70-acc1-f32b344d4795} /f
CommandLine: C:\Windows\System32\cmd.exe /c C:\Windows\Sysnative\bcdedit.exe /delete {9fb207e9-78a3-11ef-b883-b743eb480db3} /f
CommandLine: C:\Windows\System32\cmd.exe /c C:\Windows\Sysnative\bcdedit.exe /delete {9fb207ea-78a3-11ef-b883-b743eb480db3} /f
CommandLine: C:\Windows\System32\cmd.exe /c C:\Windows\Sysnative\bcdedit.exe /delete {b2721d73-1db4-4c62-bf78-c548a880142d} /f
CurrentDirectory: C:\Windows\system32\

ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
The /delete flag removes the specified boot entry from the Boot Configuration Data store, while the /f flag forces the deletion without prompting for confirmation. By deleting the Windows Boot Manager entries, the malware effectively corrupts the system's boot configuration, rendering the machine unable to load the operating system during startup.

Q8: `The malware created a scheduled task to ensure persistence and maintain control over the compromised system. This task is configured to run with elevated privileges every time the system starts, ensuring the malware continues to execute. What is the name of the scheduled task created by the malware to maintain persistence?`

Looking again for schtasks.exe usage since thats the theme here. What do you know, following the timeline with the sysmon logs (Event 1), the trail leads right to this
```
CommandLine: C:\Windows\System32\cmd.exe /c schtasks /CREATE /SC ONSTART /TN "Aa153!EGzN" /RL HIGHEST /RU SYSTEM /TR "\"C:\ProgramData\Microsoft\env\env.exe\" \"C:\temp\msconf.conf\"" /F
CurrentDirectory: C:\Windows\system32\

ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
This command created a scheduled task configured to run at system startup, the task name is Aa153!EGzN. This task is configured to run with SYSTEM privs at the highest run level. Lastly, it will execute the payload env.exe with its pen pal config file msconf.conf. Persistence established so the payload can continue to run whenever the machine boots but we all know this malware has one plan and its to wipe this local machine and all machines under the malicious GPO to the shadow relm as quick/successful as possible.

Q9: `A malicious program was used to lock the screen, preventing users from accessing the system. Investigating this malware is important to identify its behavior and mitigate its impact. What is the name of this malware? (not the filename)`

This bin + this /LOCK arg? This program is locking the system screen
```
CommandLine: "C:\temp\mssetup.exe" /LOCK
CurrentDirectory: C:\Windows\system32\
Hash lookup: SHA256=074BCC51B77D8E35B96ED444DC479B2878BF61BF7B07E4D7BD4CF136CC3C0DCE

ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
Why lock? users screen is locked so it prevents interaction with the system. To find out the actual malwares name, because we all know that bin name was renamed to (ms)setup by the attacker to blend in, we use the sha256 hash, look it up using VirusTotal and with a whopping score of 55/72, one of the names given was **BreakWin**. Heres the description from VirusTotal:

```
This sample displays clear characteristics of a Windows screen locker or desktop-disrupting malware. It uses the 'BlockInput' API to disable keyboard and mouse input, hides the system cursor via 'ShowCursor(0)', and creates a topmost, maximized window ('SW_SHOWMAXIMIZED' and 'HWND_TOPMOST' via 'SetWindowPos'). Decompilation of sub_401212 and sub_4019a6 shows it specifically targets a bitmap located at 'C:\temp\mscap.bmp' to be drawn onto the screen using GDI functions like 'BitBlt' and 'CreateCompatibleDC'. These combined behaviors are intended to lock a user out of their system and force them to view a specific image, a common tactic in ransomware and screen-locking malware families.
```

Q10: `The disk shows a pattern where malware overwrites data (potentially with zero-bytes) and then deletes it, a behavior commonly linked to Wiper malware activity. The USN (Update Sequence Number) is vital for tracking filesystem changes on an NTFS volume, enabling investigators to trace when files are created, modified, or deleted, even if they are no longer present. This is critical for building a timeline of file activity and detecting potential tampering. What is the USN associated with the deletion of the file msuser.reg?`

I returned back to the USN Journal ($J) output because it records low-level filesystem activity (file creation, mod, del, rename). We needed to target the USN associated with the deletion of msuser.reg and here is the FileDelete|Close flag operation below:

`msuser.reg,.reg,99635,1,99629,1,,11721008,2024-09-24 16:08:41.5969160,FileDelete|Close,Archive,11721008,C:\Users\Administrator\Desktop\Start Here\Artifacts\C\$Extend\$J`
The USN is a 64-bit integer so 11 72 10 08 -> 64-bit (8-byte) beautiful..done


### Some other goodies from Sysmon Event 1 logs

**Group Policy Startup Script Execution** -> A process creation event shows cmd.exe launching the malicious startup script setup.bat from the SYSVOL share:
```
Image: C:\Windows\System32\cmd.exe
CommandLine: C:\Windows\system32\cmd.exe /c ""\\WIN-499DAFSKAR7\Data\scripts\setup.bat" "
ParentImage: C:\Windows\System32\gpscript.exe
ParentCommandLine: gpscript.exe /Startup
User: NT AUTHORITY\SYSTEM
CurrentDirectory: \\abc.local\SysVol\abc.local\Policies\{8C069217-9EBB-454D-BE84-32317C017A0C}\Machine\Scripts\Startup\
```
So gpscript.exe executed the malicious script setup.bat which was stored on the SYSVOL network share. The script was executed during system startup with elevated privs since we see NT AUTHORITY\SYSTEM. Proves execution-level confirmation

**Reconnaissance and Network Disruption Commands** -> The attacker appears to perform light reconnaissance and potential network disruption through additional commands executed by the script: `CommandLine: cmd.exe /c hostname` and
```
Image: C:\Windows\System32\ipconfig.exe   
CommandLine: ipconfig /release    #release the DHCP lease disconnecting the machine from its current network configuration
CurrentDirectory: C:\ProgramData\Microsoft\env\
```
**Disabling Network Adapters** -> A more aggressive attempt to disable network interfaces:
```
Image: C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
CommandLine: powershell -Command "Get-WmiObject -class Win32_NetworkAdapter | ForEach { If ($_.NetEnabled) { $_.Disable() } }" #iterate through all network adapters and disable any that are currently enabled, cutting off network connectivity entirely which tracks with wiper malware or destructive attack operations.
CurrentDirectory: C:\ProgramData\Microsoft\env\ 
```
**Additional File Created During Archive Extraction**
```
TargetFilename: C:\ProgramData\Microsoft\env\cache.bat #an additional script likely deployed as part of the extracted payload
Image: C:\ProgramData\Microsoft\env\Rar.exe
```

**Additional file added to the Windows Defender exclusion list** 
```
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\programs.rar'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\cache.bat'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\ms.rar'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\msrun.bat'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\mssetup.exe'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\msconf.conf'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env"\bcd.bat'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\
CommandLine: powershell  -Command "Add-MpPreference -Force -ExclusionPath '"C:\ProgramData\Microsoft\env\env.exe"'" 
CurrentDirectory: C:\ProgramData\Microsoft\env\

ParentImage: C:\Windows\System32\cmd.exe
ParentCommandLine: C:\Windows\system32\cmd.exe /c ""\\WIN-499DAFSKAR7\Data\scripts\setup.bat" "
```

**RaR-ing these archives** -> Once bcd.bat was added to the exclusion path, then bcd.rar archive was de-compressed with WinRaR. same goes for the rest found
```
CommandLine: "Rar.exe"  x "C:\ProgramData\Microsoft\env\bcd.rar" -phackemall
CurrentDirectory: C:\ProgramData\Microsoft\env\

CommandLine: "Rar.exe"  x "C:\ProgramData\Microsoft\env\ms.rar" -phackemall
CurrentDirectory: C:\ProgramData\Microsoft\env\
```

**Viewing the Boot Configuration Data store**
```
CommandLine: C:\Windows\system32\cmd.exe /c bcdedit /v | findstr identifier
# verbose output and findstr is filtering the output and only printing the identifier info for each boot entry -- signal potential wiper malware 
CurrentDirectory: C:\ProgramData\Microsoft\env\
```

**Reg key modification** -> HKLM applying to all users. These two commands force the system lock screen background to a specific image (C:\temp\mscap.jpg) via Windows policy settings
```
OriginalFileName: reg.exe
CommandLine: reg  add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP" /v LockScreenImagePath /t REG_SZ /d C:\temp\mscap.jpg /f

CommandLine: reg  add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP" /v LockScreenImageUrl /t REG_SZ /d C:\temp\mscap.jpg /f
CurrentDirectory: C:\ProgramData\Microsoft\env\
```

**Classic Living-off-the-Land (LotL) malware behavior below used during this wiper operation**

```
takeown.exe
icacls.exe
cmd.exe
wmic
bcdedit
schtasks
```

**One cool piece of commands to setup the screen-locking operation**
```
CommandLine: C:\Windows\System32\cmd.exe /c takeown.exe /F "C:\Windows\Web\Screen" /R /A /D Y
CommandLine: C:\Windows\System32\cmd.exe /c icacls.exe "C:\Windows\Web\Screen" /grant System:(OI)(CI)F /T
CommandLine: C:\Windows\System32\cmd.exe /c icacls.exe "C:\Windows\Web\Screen" /grant Administrators:(OI)(CI)F /T
CommandLine: C:\Windows\System32\cmd.exe /c icacls.exe "C:\Windows\Web\Screen" /reset /T
CommandLine: C:\Windows\System32\cmd.exe /c takeown.exe /F "C:\ProgramData\Microsoft\Windows\SystemData" /R /A /D Y
CommandLine: C:\Windows\System32\cmd.exe /c icacls.exe "C:\ProgramData\Microsoft\Windows\SystemData" /grant System:(OI)(CI)F /T
CommandLine: C:\Windows\System32\cmd.exe /c icacls.exe "C:\ProgramData\Microsoft\Windows\SystemData" /grant Administrators:(OI)(CI)F /T
C:\Windows\System32\cmd.exe /c icacls.exe "C:\ProgramData\Microsoft\Windows\SystemData\S-1-5-18\ReadOnly" /reset /T
all under this: CurrentDirectory: C:\Windows\system32\

and all under this Parent:
ParentCommandLine: C:\ProgramData\Microsoft\env\env.exe C:\temp\msconf.conf
ParentUser: NT AUTHORITY\SYSTEM
```
These commands are executed to most likely take ownership/modify permissions of Windows lock screen directories so it can replace/control lock screen assets, which will support the BreakWin (mssetup) payload.

