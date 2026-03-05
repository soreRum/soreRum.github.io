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



