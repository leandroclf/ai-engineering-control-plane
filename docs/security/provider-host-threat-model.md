# Provider Host Threat Model

O host possui a sessão do titular e executa software que pode ser influenciado
por prompt injection. Controles são: zona dedicada, ambiente allowlisted,
flags sandbox oficiais, no `danger-full-access`, output bounded, process
supervision, checkpoint restore e evidence sanitizada.

Credential isolation é release-blocking. Sem prova de que child tools não leem a
sessão vendor no OS alvo, o provider permanece `BLOCKED` e `LOCAL_PERSONAL`.
