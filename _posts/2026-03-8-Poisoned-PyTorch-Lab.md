### Poisoned PyTorch Lab

Goal: `Investigate a software supply-chain compromise that escalates into a ransomware attack, with emphasis on identifying pre-encryption operations.`

Just notes....

Initial access due to a supply chain attack via pytorch (torch dependency). torch is a trusted third-part Python library that was compromised in this lab to slot in a backdoor. 
Since the developer was running a Python training script from VSCode (AI/ML project), the trusted torch lib was imported at runtime and it was the compromised version containing the malicious backdoor line to execute. 
