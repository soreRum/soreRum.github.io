## MeteorHit - Indra Lab on CyberDefenders

**Goal:** Reconstruct a wiper malware attack by analyzing registry, event logs, and USN journal artifacts using Registry Explorer, Event Log Explorer, and VirusTotal.

Initial investigations reveal that attackers compromised the Active Directory (AD) system and deployed wiper malware across multiple machines. You have been provided with forensic artifacts collected via KAPE SANS Triage from one of the affected machines to determine how the attackers gained access, the scope of the malware's deployment, and what critical systems or data were impacted before the shutdown

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

The KAPE artifcat structure shows filesystem artifacts (filesystem triage collection) pulled from the root of C: so this drive structure was reconstructed. The GPO ran the script so two things can be covered: the script itself, a file and the config that instructs the OS to run the script

instructions on the config part: What script to run, when to run it, where the scipt is located. without this, how would the OS know to execute it?
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

This artifact can help identify when a file appeared on disk or when bursts of file activity occurred, which could indicate archive extraction or malware staging activity. The tool used to analyze the USN Journal is MFTECmd.Using the USN Journal output, I can look for file activity around the timeline of the malicious GPO execution, since the startup script deployed through the GPO likely triggered the staging process shortly afterward. Earlier in the investigation, the GPO policy responsible for executing the malicious script had a last write timestamp of 16:04:11, so I focused on file activity occurring shortly after that time. By sorting and filtering the USN Journal output around that timeframe, I was able to identify suspicious file activity beginning around 16:04:16, which closely correlates with the policy execution timeline. The USN entries for env.cab show a sequence of operations such as FileCreate, DataExtend, DataOverwrite, and BasicInfoChange, which indicates the file was created and written to disk at that time. This sequence of events typically occurs when a file is first created and its contents are written by a process. Later USN entries for the same file show additional activity such as DataOverwrite and FileDelete, indicating the file was modified and eventually deleted around 16:08:35. This behavior is consistent with a temporary staging file, where an archive is written to disk, its contents are extracted, and the archive is removed afterward. The USN Journal output typically does not contain the full file path, because it references files using File Reference Numbers (FRN) rather than directory paths. In the USN output, env.cab was associated with File Reference Number 97892 and Parent FRN 97053. To resolve the full location of the file, I pivoted to the $MFT output, which maps those file reference numbers to their actual directory structure.

Looking up FRN 97892 in the $MFT output revealed an entry showing the directory path .\ProgramData\Microsoft\env with the file name env.cab. Reconstructing this directory with the system drive results in the full file path:

`C:\ProgramData\Microsoft\env\env.cab`

The timestamps in the $MFT entry also matched the behavior observed in the USN Journal, showing the file being created at 16:04:16 and later modified and removed around 16:08:35, further confirming the file’s role as a temporary staging archive during the attack.

Following this process revealed the container file used in the staging phase of the attack, located at:

`C:\ProgramData\Microsoft\env\env.cab`

This CAB archive likely contained compressed components required for later stages of the attack, which were expanded using a built-in Windows utility as part of the malware deployment process. Attackers often use compressed archives to stage malware, and Windows includes built-in utilities for expanding compressed files such as CAB archives.


