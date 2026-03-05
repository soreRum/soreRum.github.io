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

The KAPE artifcat structure shows filesystem artifacts (filesystem triage collection) pulled from the root of C: so this drive structure was reconstructed. The Security logs for this machine didnt contain events 5136/37 event codes so I assuming that this is a regular user machine who recieves GPOs from a centrally managed domain controller, the machine cannot generate them, the audit policy wasnt enabled, or the artifact collection didnt include the relevant logs. When the centrally managed machine applies a GPO for this machine, what artifacts within this C:/ drive exist locally for it to execute?

a copy of policy files, a comp to retrieve those files and a comp that executes the policy settings/scripts?



