# Contract: terminal menu strings

Target strings for `src/i18n.ts`, given as en | pt-BR | es | fr. Rows marked **new** add a key. Rows marked **changed** replace the baseline value in the locales listed. Keys not listed keep their baseline values. Wording can be adjusted during implementation only if it still meets the [glossary](../research.md#r7--per-locale-glossary-fr-012) and the [identity rules](navigation.md#identity-rules); every adjustment must also be made in [docs/menu-diagrams.md](../../../docs/menu-diagrams.md).

Placeholders (`{…}`) are unchanged. Proper nouns and tokens (WhatsApp, Edge, OpenAI-compatible, Fish, mp3/wav/opus, JID, URLs, `--whatsapp-ng-online`) are never translated.

## Navigation and hints

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.close` new | Close settings | Fechar configurações | Cerrar ajustes | Fermer les réglages |
| `menu.hint.esc` new | Esc closes settings | Esc fecha as configurações | Esc cierra los ajustes | Échap ferme les réglages |
| `menu.back.main` new | Back to main menu | Voltar ao menu principal | Volver al menú principal | Retour au menu principal |
| `menu.back.connection` new | Back to Connection | Voltar para Conexão | Volver a Conexión | Retour au menu Connexion |
| `menu.back.chatsOwner` new | Back to Chats / Owner | Voltar para Conversas / Proprietário | Volver a Chats / Propietario | Retour au menu Discussions / Propriétaire |
| `menu.back.replies` new | Back to Replies | Voltar para Respostas | Volver a Respuestas | Retour au menu Réponses |
| `menu.back.groups` new | Back to Groups | Voltar para Grupos | Volver a Grupos | Retour au menu Groupes |
| `menu.back.advanced` new | Back to Advanced | Voltar para Avançado | Volver a Avanzado | Retour au menu Avancé |
| `menu.back.optionalOutputs` new | Back to Optional outputs | Voltar para Saídas opcionais | Volver a Salidas opcionales | Retour aux Sorties facultatives |
| `menu.back.allowedContacts` new | Back to Allowed contacts | Voltar para Contatos permitidos | Volver a Contactos permitidos | Retour aux Contacts autorisés |
| `menu.back.allowedGroups` new | Back to Allowed groups | Voltar para Grupos permitidos | Volver a Grupos permitidos | Retour aux Groupes autorisés |
| `menu.back.recents` new | Back to Recents | Voltar para Recentes | Volver a Recientes | Retour aux Récents |
| `menu.back.conversation` new | Back to conversation | Voltar para a conversa | Volver a la conversación | Retour à la conversation |
| `menu.back.contact` new | Back to contact | Voltar para o contato | Volver al contacto | Retour au contact |
| `menu.back.group` new | Back to group | Voltar para o grupo | Volver al grupo | Retour au groupe |
| `menu.back.voice` new | Back to Voice | Voltar para Voz | Volver a Voz | Retour au menu Voix |
| `menu.back.voiceAdvanced` new | Back to Advanced speech settings | Voltar para Configurações avançadas de voz | Volver a Ajustes avanzados de voz | Retour aux Réglages vocaux avancés |
| `menu.back.voiceBackend` new | Back to speech service | Voltar para o serviço de voz | Volver al servicio de voz | Retour au service vocal |
| `menu.back.voiceProtocol` new | Back to protocol | Voltar para o protocolo | Volver al protocolo | Retour au protocole |
| `menu.back.chatList` new | Back to chat list | Voltar para a lista de conversas | Volver a la lista de chats | Retour à la liste des discussions |
| `menu.back.chatSettings` new | Back to chat settings | Voltar para as configurações da conversa | Volver a los ajustes del chat | Retour aux réglages de la discussion |
| `menu.expired` new | Settings changed while this menu was open. Reopen /whatsapp. | As configurações mudaram com este menu aberto. Abra /whatsapp novamente. | Los ajustes cambiaron mientras este menú estaba abierto. Vuelve a abrir /whatsapp. | Les réglages ont changé pendant que ce menu était ouvert. Rouvrez /whatsapp. |
| `menu.optionsChanged` new | Settings options changed. Choose again. | As opções mudaram. Escolha novamente. | Las opciones cambiaron. Elige de nuevo. | Les options ont changé. Choisissez à nouveau. |

The English `menu.expired` value equals the baseline literal, so its English output is unchanged.

## Root, categories and state words

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.root.title` new | WhatsApp — {state} (transport: {status}) | WhatsApp — {state} (transporte: {status}) | WhatsApp — {state} (transporte: {status}) | WhatsApp — {state} (transport : {status}) |
| `menu.state.enabled` new | Enabled | Ativado | Activado | Activé |
| `menu.state.off` new | Off | Desligado | Apagado | Désactivé |
| `menu.status.connected` new | connected | conectado | conectado | connecté |
| `menu.status.disconnected` new | disconnected | desconectado | desconectado | déconnecté |
| `menu.status.pairing` new | pairing | pareando | emparejando | appairage |
| `menu.status.logged-out` new | logged out | sem login | sin sesión | sans session |
| `menu.on` / `menu.off` new | On / Off | Ativo / Inativo | Activo / Inactivo | Activé / Désactivé |
| `menu.category.connection` new | Connection | Conexão | Conexión | Connexion |
| `menu.category.chatsOwner` new | Chats / Owner | Conversas / Proprietário | Chats / Propietario | Discussions / Propriétaire |
| `menu.category.replies` new | Replies | Respostas | Respuestas | Réponses |
| `menu.category.groups` new | Groups | Grupos | Grupos | Groupes |
| `menu.category.advanced` new | Advanced | Avançado | Avanzado | Avancé |
| `voice.menu` (Voice category) | Voice | Voz | Voz | Voix |

The English root title is the baseline literal with `logged-out` rendered as "logged out".

## Connection and Advanced

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.connection.turnOff` new | Turn WhatsApp off | Desligar WhatsApp | Apagar WhatsApp | Désactiver WhatsApp |
| `menu.connection.autoConnect` new | Auto-connect on startup | Conectar automaticamente ao iniciar | Conectar automáticamente al iniciar | Connexion automatique au démarrage |
| `menu.autoConnect.title` new | Auto-connect on startup: {state} | Conectar automaticamente ao iniciar: {state} | Conectar automáticamente al iniciar: {state} | Connexion automatique au démarrage : {state} |
| `menu.autoConnect.enabled` new | Enabled | Ativado | Activado | Activé |
| `menu.autoConnect.disabled` new | Disabled | Desativado | Desactivado | Désactivé |
| `menu.autoConnect.saved` new | *(baseline English literal)* | Preferência de conexão automática salva para futuras inicializações TUI/RPC e carregamentos de sessão; a conexão atual não muda. Compartilhada pelos processos Pi deste perfil; Desligado vale só no processo atual. --whatsapp-ng-online continua sendo uma solicitação explícita. | Preferencia de conexión automática guardada para futuros inicios TUI/RPC y cargas de sesión; la conexión actual no cambia. La comparten los procesos Pi de este perfil; Apagado solo persiste en el proceso actual. --whatsapp-ng-online sigue siendo una solicitud explícita. | Préférence de connexion automatique enregistrée pour les prochains démarrages TUI/RPC et chargements de session ; la connexion actuelle ne change pas. Partagée par les processus Pi de ce profil ; Désactivé ne persiste que dans le processus actuel. --whatsapp-ng-online reste une demande explicite. |
| `menu.connection.offNotice` new | WhatsApp is off. Login and history retained; re-enable from {connection}. | WhatsApp desligado. Login e histórico mantidos; reative em {connection}. | WhatsApp está apagado. Se conservan la sesión y el historial; reactívalo desde {connection}. | WhatsApp est désactivé. Identifiants et historique conservés ; réactivez-le depuis {connection}. |
| `menu.root.reconnectStarted` changed | WhatsApp reconnect started | — | — | — |
| `menu.root.pairingStarted` changed | WhatsApp pairing started | — | — | — |
| `menu.advanced.privacy` new | Privacy and logs | Privacidade e registros | Privacidad y registros | Confidentialité et journaux |
| `menu.root.logoffDeleteSession` changed | Log out and delete saved login | Sair e excluir o login salvo | Cerrar sesión y eliminar las credenciales guardadas | Se déconnecter et supprimer les identifiants enregistrés |
| `menu.root.logoffTitle` changed | Log out and delete saved login? | Sair e excluir o login salvo? | ¿Cerrar sesión y eliminar las credenciales guardadas? | Se déconnecter et supprimer les identifiants enregistrés ? |
| `menu.root.loggedOffAndDeleted` changed (pt) | — | Sessão encerrada e credenciais excluídas | — | — |

`{connection}` is filled with `menu.category.connection`. The English offNotice equals the baseline literal. `menu.root.logoffConfirmMessage` ("Delete all credentials?") is unchanged.

## Allowed contacts and groups

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.root.allowedNumbers`, `menu.allowed.title` changed | Allowed contacts | Contatos permitidos | — | — |
| `menu.allowed.printAllowedNumbersTitle` changed (pt) | — | [WhatsApp-NG] Contatos permitidos | — | — |
| `menu.allowed.addNumber` changed (en) | Add contact | — | — | — |
| `menu.allowed.enterNumber` changed | Enter phone number (e.g. +5511999999999): | Digite o número de telefone (ex.: +5511999999999): | Ingresa el número de teléfono (p. ej. +5511999999999): | Entrez le numéro de téléphone (ex. +5511999999999) : |
| `menu.allowed.invalidNumber` changed | Invalid phone number format | Formato de número de telefone inválido | Formato de número de teléfono inválido | Format de numéro de téléphone invalide |
| `menu.allowed.contact.title` changed | Allowed contact • {displayName} | Contato permitido • {displayName} | — | — |
| `menu.allowed.contact.sendMessage` changed (en) | Send message | — | — | — |
| `menu.allowed.contact.addNumber` changed | Set sending number | Definir número de envio | Definir número de envío | Définir le numéro d’envoi |
| `menu.allowed.contact.removeSendNumber` changed | Remove sending number | Remover número de envio | Quitar número de envío | Supprimer le numéro d’envoi |
| `menu.allowed.contact.printNumber` changed | Show phone number | Mostrar número de telefone | Mostrar número de teléfono | Afficher le numéro de téléphone |
| `menu.allowed.contact.addAlias` / `removeAlias` changed (en) | Add alias / Remove alias | — | — | — |
| `menu.allowed.contact.removeNumber`, `menu.allowed.removeConfirmTitle` changed | Remove from allowed contacts | Remover dos contatos permitidos | Quitar de contactos permitidos | Retirer des contacts autorisés |
| `menu.allowed.removeConfirmMessage` changed (pt) | — | Remover {displayName} dos Contatos permitidos? | — | — |
| `menu.allowed.contact.enterNumber` changed (fr) | — | — | — | Entrez le numéro d’envoi pour {displayName} : |
| `menu.allowed.contact.numberAdded` changed | Sending number set for {displayName} | Número de envio definido para {displayName} | Número de envío definido para {displayName} | Numéro d’envoi défini pour {displayName} |
| `menu.allowed.contact.numberRemoved` changed | Sending number removed for {displayName} | — | Número de envío quitado para {displayName} | Numéro d’envoi supprimé pour {displayName} |
| `menu.root.allowedGroups`, `menu.allowedGroups.title` changed | Allowed groups | — | — | — |
| `menu.allowedGroups.addGroup` | Add group | Adicionar grupo | Agregar grupo | Ajouter un groupe |
| `menu.allowedGroups.enterGroup` | Enter group JID (e.g. 120363012345@g.us): | *(baseline)* | Ingresa el JID del grupo (p. ej. 120363012345@g.us): | Entrez le JID du groupe (ex. 120363012345@g.us) : |
| `menu.allowedGroups.invalidGroup` | *(baseline)* | *(baseline)* | JID de grupo no válido | JID de groupe invalide |
| `menu.allowedGroups.group.title` | Allowed group • {displayName} | *(baseline)* | Grupo permitido • {displayName} | Groupe autorisé • {displayName} |
| `menu.allowedGroups.group.history` | *(baseline)* | *(baseline)* | Historial | Historique |
| `menu.allowedGroups.group.sendMessage` | Send message | *(baseline)* | Enviar mensaje | Envoyer un message |
| `menu.allowedGroups.group.printGroup` | Show group JID | *(baseline)* | Mostrar JID del grupo | Afficher le JID du groupe |
| `menu.allowedGroups.group.addAlias` / `removeAlias` | Add alias / Remove alias | *(baseline)* | Agregar alias / Quitar alias | Ajouter un alias / Supprimer l’alias |
| `menu.allowedGroups.group.removeGroup`, `menu.allowedGroups.removeConfirmTitle` | Remove from allowed groups | Remover dos grupos permitidos | Quitar de grupos permitidos | Retirer des groupes autorisés |
| `menu.allowedGroups.removeConfirmMessage` | *(baseline)* | *(baseline)* | ¿Quitar {displayName} de Grupos permitidos? | Retirer {displayName} des Groupes autorisés ? |
| `menu.allowedGroups.enterAlias` | *(baseline)* | *(baseline)* | Ingresa alias para {groupJid}: | Entrez un alias pour {groupJid} : |
| `menu.allowedGroups.pleaseEnterAlias` | *(baseline)* | *(baseline)* | Ingresa un alias. | Veuillez saisir un alias. |
| `menu.allowedGroups.aliasAdded` / `aliasRemoved` | *(baseline)* | *(baseline)* | Alias agregado para {groupJid} / Alias quitado para {groupJid} | Alias ajouté pour {groupJid} / Alias supprimé pour {groupJid} |
| `menu.allowedGroups.removed` | *(baseline)* | *(baseline)* | Quitado {displayName} | {displayName} retiré |
| `menu.allowedGroups.addedToAllowList`, `menu.recents.addedGroupToAllowList` | *(baseline)* | *(baseline)* | Agregado {groupJid} a la lista de grupos permitidos | {groupJid} ajouté à la liste des groupes autorisés |
| `menu.allowedGroups.printAllowedGroupsTitle` | *(baseline)* | *(baseline)* | [WhatsApp-NG] Grupos permitidos | [WhatsApp-NG] Groupes autorisés |

The es/fr values for `menu.allowedGroups.*` and `menu.recents.contact.allowGroup` / `menu.recents.addedGroupToAllowList` are new translations: the baseline has no es/fr entries for these keys.

## Recents, History and message detail

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.recents.contact.allowNumber` changed | Allow contact | Permitir contato | — | — |
| `menu.recents.contact.allowGroup` | Allow group | *(baseline)* | Permitir grupo | Autoriser le groupe |
| `menu.recents.contact.removeAlias` changed (en) | Remove alias | — | — | — |
| `menu.recents.grouped.contacts` / `grouped.title` changed (pt) | — | ({count} contatos) / Recentes • ({count} contatos) | — | — |
| `menu.recents.groupPrefix` new | [Group] | [Grupo] | [Grupo] | [Groupe] |
| `menu.page.previous` new | Previous page | Página anterior | Página anterior | Page précédente |
| `menu.page.next` new | Next page | Próxima página | Página siguiente | Page suivante |
| `message.detail.hint.replyOrClose` changed | Press R to reply • Enter or Esc returns to History | Pressione R para responder • Enter ou Esc volta ao Histórico | Pulsa R para responder • Enter o Esc vuelve al Historial | Appuyez sur R pour répondre • Entrée ou Échap revient à l’Historique |
| `message.detail.hint.close` changed | Enter or Esc returns to History | Enter ou Esc volta ao Histórico | Enter o Esc vuelve al Historial | Entrée ou Échap revient à l’Historique |

The send-failure fallback `'Unknown error'` uses the existing `message.reply.unknownError` key.

## Replies, reporting and optional outputs

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.replyDelivery.title` | *(baseline)* | Entrega de respostas | Entrega de respuestas | Livraison des réponses |
| `menu.replyDelivery.explain` | *(baseline)* | Explicar após anexos (padrão) | Explicar después de adjuntos (predeterminado) | Expliquer après les pièces jointes (par défaut) |
| `menu.replyDelivery.legacy` | *(baseline)* | Somente legenda/ferramenta (legado) | Solo leyenda/herramienta (heredado) | Légende/outil uniquement (ancien) |
| `menu.replyDelivery.current` | *(baseline)* | Entrega de respostas — atual: {current} | Entrega de respuestas — actual: {current} | Livraison des réponses — actuel : {current} |
| `menu.replyDelivery.status` new | {base} — final stats: {stats}; files {files}, interim {interim}, activity {activity} | {base} — estatísticas finais: {stats}; arquivos {files}, intermediário {interim}, atividade {activity} | {base} — estadísticas finales: {stats}; archivos {files}, intermedio {interim}, actividad {activity} | {base} — statistiques finales : {stats} ; fichiers {files}, intermédiaire {interim}, activité {activity} |
| `menu.replyDelivery.saved` | *(baseline)* | Preferência de entrega salva. Vale para novas solicitações. | Preferencia de entrega guardada. Se aplica a nuevas solicitudes. | Préférence de livraison enregistrée. S’applique aux nouvelles demandes. |
| `menu.replyDelivery.statsOn` | *(baseline)* | Ativar estatísticas finais para conversas permitidas | Activar estadísticas finales para chats permitidos | Activer les statistiques finales pour les discussions autorisées |
| `menu.replyDelivery.statsOff` | *(baseline)* | Desativar estatísticas finais | Desactivar estadísticas finales | Désactiver les statistiques finales |
| `menu.replyDelivery.statsSaved` | *(baseline)* | Preferência de estatísticas finais salva. Vale para novas respostas do WhatsApp; estatísticas pendentes são retiradas. | Preferencia de estadísticas finales guardada. Se aplica a nuevas respuestas de WhatsApp; las estadísticas pendientes se retiran. | Préférence de statistiques finales enregistrée. S’applique aux nouvelles réponses WhatsApp ; les statistiques en attente sont retirées. |
| `menu.reporting.files.enable` / `.disable` new | Enable / Disable observed file paths | Ativar / Desativar caminhos de arquivos observados | Activar / Desactivar rutas de archivos observadas | Activer / Désactiver les chemins de fichiers observés |
| `menu.reporting.interim.enable` / `.disable` new | Enable / Disable interim assistant text | Ativar / Desativar texto intermediário do assistente | Activar / Desactivar texto intermedio del asistente | Activer / Désactiver le texte intermédiaire de l’assistant |
| `menu.reporting.activity.enable` / `.disable` new | Enable / Disable live tool activity | Ativar / Desativar atividade de ferramentas ao vivo | Activar / Desactivar actividad de herramientas en vivo | Activer / Désactiver l’activité des outils en direct |
| `menu.reporting.invalid` new | *(baseline English literal)* | Configurações de relatório salvas são inválidas. Uma escolha de relatório as substitui explicitamente; outras escolhas as preservam. | Los ajustes de informes guardados no son válidos. Una opción de informes los reemplaza explícitamente; las demás los conservan. | Les réglages de rapport enregistrés sont invalides. Un choix de rapport les remplace explicitement ; les autres choix les conservent. |
| `menu.reporting.saved` new | *(baseline English literal)* | Relatórios de resposta salvos para futuras entradas do WhatsApp; relatórios pendentes anteriores são retirados. | Informes de respuesta guardados para futuras entradas de WhatsApp; los informes pendientes anteriores se retiran. | Rapports de réponse enregistrés pour les prochaines entrées WhatsApp ; les rapports en attente sont retirés. |
| `menu.optional.title` new (label + panel name) | Optional outputs | Saídas opcionais | Salidas opcionales | Sorties facultatives |
| `menu.optional.status` new | Optional outputs — image tools: {count}; terminal forwarding: {state} | Saídas opcionais — ferramentas de imagem: {count}; encaminhamento do terminal: {state} | Salidas opcionales — herramientas de imagen: {count}; reenvío del terminal: {state} | Sorties facultatives — outils d’image : {count} ; transfert du terminal : {state} |
| `menu.optional.chooseImages` new | Choose automatic image tools | Escolher ferramentas de imagem automáticas | Elegir herramientas de imagen automáticas | Choisir les outils d’image automatiques |
| `menu.optional.clearImages` new | Disable automatic images | Desativar imagens automáticas | Desactivar imágenes automáticas | Désactiver les images automatiques |
| `menu.optional.terminalOn` new | Enable terminal forwarding to owner | Ativar encaminhamento do terminal ao proprietário | Activar reenvío del terminal al propietario | Activer le transfert du terminal au propriétaire |
| `menu.optional.terminalOff` new | Disable terminal forwarding | Desativar encaminhamento do terminal | Desactivar reenvío del terminal | Désactiver le transfert du terminal |
| `menu.optional.imageTitle` new | Only actual image result blocks from individually selected tools | Somente blocos de imagem reais de ferramentas selecionadas individualmente | Solo bloques de imagen reales de herramientas seleccionadas individualmente | Uniquement les blocs d’image réels des outils sélectionnés individuellement |
| `menu.optional.toolOn` / `toolOff` new | Enable {tool} / Disable {tool} | Ativar {tool} / Desativar {tool} | Activar {tool} / Desactivar {tool} | Activer {tool} / Désactiver {tool} |
| `menu.optional.invalid` new | *(baseline English literal)* | Configurações de saídas opcionais inválidas. Uma escolha explícita as reparará. | Ajustes de salidas opcionales no válidos. Una elección explícita los reparará. | Réglages de sorties facultatives invalides. Un choix explicite les réparera. |
| `menu.optional.ownerMissing` new | *(baseline English literal)* | Conecte o WhatsApp e configure antes um proprietário privado permitido. Vínculo de grupo ou redirecionamentos do gateway não podem ser contornados. | Conecta WhatsApp y configura antes un propietario privado permitido. El grupo vinculado y las redirecciones del gateway no se pueden eludir. | Connectez WhatsApp et configurez d’abord un propriétaire privé autorisé. La liaison de groupe et les redirections de la passerelle ne peuvent pas être contournées. |
| `menu.optional.saved` new | *(baseline English literal)* | Saídas opcionais salvas para novas entradas. Trabalho em andamento não é incluído. | Salidas opcionales guardadas para nuevas entradas. El trabajo en curso no se incluye. | Sorties facultatives enregistrées pour les nouvelles entrées. Les travaux en cours ne sont pas inclus. |

## Group replies

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `menu.groups.replies` new | Group replies | Respostas em grupos | Respuestas en grupos | Réponses dans les groupes |
| `menu.groups.title` new | Shared group replies: {mode} / preceding context {state} | Respostas em grupos (compartilhado): {mode} / contexto anterior {state} | Respuestas en grupos (compartido): {mode} / contexto anterior {state} | Réponses dans les groupes (partagé) : {mode} / contexte précédent {state} |
| `menu.groups.invalid` new | Invalid saved group policy; choose explicitly to repair | Política de grupos salva inválida; escolha explicitamente para reparar | Política de grupos guardada no válida; elige explícitamente para repararla | Politique de groupes enregistrée invalide ; choisissez explicitement pour la réparer |
| `menu.groups.mode.mentions-or-replies` new | Mentions or replies (default) | Menções ou respostas (padrão) | Menciones o respuestas (predeterminado) | Mentions ou réponses (par défaut) |
| `menu.groups.mode.mentions` new | Mentions only | Somente menções | Solo menciones | Mentions uniquement |
| `menu.groups.mode.replies` new | Replies only | Somente respostas | Solo respuestas | Réponses uniquement |
| `menu.groups.mode.all` new | Every allowed group message | Todas as mensagens de grupos permitidos | Todos los mensajes de grupos permitidos | Tous les messages des groupes autorisés |
| `menu.groups.contextOn` / `contextOff` new | Enable / Disable preceding text context | Ativar / Desativar contexto de texto anterior | Activar / Desactivar contexto de texto anterior | Activer / Désactiver le contexte des messages précédents |
| `menu.groups.saved` new | *(baseline English literal)* | Política compartilhada de respostas em grupos salva para novas solicitações. Conversas pausadas continuam pausadas; trabalho antigo não é repetido. | Política compartida de respuestas en grupos guardada para nuevas solicitudes. Los chats pausados siguen pausados; el trabajo anterior no se repite. | Politique partagée de réponses dans les groupes enregistrée pour les nouvelles demandes. Les discussions suspendues le restent ; les travaux antérieurs ne sont pas rejoués. |

## Voice and Owner

| Key | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `voice.chooseChat` new | Choose a chat | Escolha uma conversa | Elige un chat | Choisissez une discussion |
| `voice.chats` changed | Chat settings: mode, automatic replies, introduction | Configurações da conversa: modo, respostas automáticas, apresentação | Ajustes del chat: modo, respuestas automáticas, presentación | Réglages d’une discussion : mode, réponses automatiques, présentation |
| `voice.advanced` changed (es, fr) | — | — | Ajustes avanzados de voz | Réglages vocaux avancés |
| `voice.backend` changed | Speech service (Edge or remote) | Serviço de voz (Edge ou remoto) | Servicio de voz (Edge o remoto) | Service vocal (Edge ou distant) |
| `voice.remote` changed | Remote speech service (HTTP API) | Serviço de voz remoto (API HTTP) | Servicio de voz remoto (API HTTP) | Service vocal distant (API HTTP) |
| `voice.edgeVoice` changed | Edge voice | Voz do Edge | Voz de Edge | Voix Edge |
| `voice.providerVoice` changed | Remote voice or reference ID | Voz remota ou ID de referência | Voz remota o ID de referencia | Voix distante ou identifiant de référence |
| `voice.format` changed | Remote audio format | Formato de áudio remoto | Formato de audio remoto | Format audio distant |
| `voice.defaultMode` changed | Default reply mode (per-chat modes kept) | Modo de resposta padrão (modos por conversa mantidos) | Modo de respuesta predeterminado (se mantienen los modos por chat) | Mode de réponse par défaut (modes par discussion conservés) |
| `voice.preview` changed | Send fixed-phrase voice preview (review first) | Enviar prévia de voz com frase fixa (revisar antes) | Enviar vista previa de voz con frase fija (revisar antes) | Envoyer un aperçu vocal à phrase fixe (vérifier d’abord) |
| `voice.introduce` changed | Send AI-assistant introduction (review first) | Enviar apresentação do assistente de IA (revisar antes) | Enviar presentación del asistente de IA (revisar antes) | Envoyer la présentation de l’assistant IA (vérifier d’abord) |
| `voice.disable` changed | Turn speech off everywhere (revoke consent) | Desativar voz em todas as conversas (revogar consentimento) | Desactivar voz en todos los chats (revocar consentimiento) | Désactiver la voix partout (révoquer le consentement) |
| `voice.enterOwner` changed | Enter phone number or person JID | Informar telefone ou JID de pessoa | Ingresa un teléfono o JID de persona | Saisir un téléphone ou un JID de personne |

`voice.changed` uses “Los ajustes de voz …” (es) / “Les réglages vocaux …” (fr) after the manual glossary review; es `voice.edge` reads “Microsoft / Edge (en línea, no oficial)”.

`voice.previewConfirmTitle` and `voice.introduceConfirmTitle` retain the baseline `voice.preview` / `voice.introduce` confirmation titles in all four locales. The menu options use the new wording; confirmation bodies and titles stay as before.

The English sending-number input is “Enter sending number for {displayName}:”. `message.detail.noReadableText` and `message.reply.noReadableText` replace the visible English leftovers: pt-BR “[Nenhum texto legível disponível]”, es “[No hay texto legible]”, fr “[Aucun texte lisible]”.

`voice.setupChat`, `voice.owner`, `voice.menu`, mode labels and all consent, review and authorization bodies are unchanged. `voice.setupChat` is cited by the phone `/voice` reply, and `voice.owner` by owner guidance.

## Removed keys

`menu.root.back`, `menu.allowed.contact.back`, `menu.allowedGroups.group.back`, `menu.recents.contact.back` are removed from every locale, but only once no source references them ([research R9](../research.md#r9--unused-keys)).

## Documented exceptions (SC-002)

These may remain English or identical across locales:

- proper nouns and tokens listed above, user data, and the machine-readable archive account marker `legacy-unassigned`;
- the privacy and logs notice `METADATA_LOG_POLICY` (`src/services/whatsapp-ng.logger.ts`), unchanged and shared with the logger;
- the hardcoded English confirmation titles and bodies, unchanged byte for byte ([research R6](../research.md#r6--confirmations-consent-and-policy-text)):

| Owner | Title | Body |
| --- | --- | --- |
| `MenuHandler.showSettings` (Connection) | Turn WhatsApp off? | Stop intake, abort shared Pi work and cancel pending WhatsApp output? … |
| `MenuHandler.showSettings` (Reply delivery) | Enable optional reply reporting? | Share observed workspace-relative file paths, … |
| `MenuHandler.manageGroupReplies` | Enable group context? | Future allowed group text may be sent with triggered model requests … |
| `showOptionalOutputSettings` (image tools) | Allow automatic tool images? | Image result blocks from {name} in verified WhatsApp work … |
| `showOptionalOutputSettings` (terminal forwarding) | Forward terminal answers? | Future terminal/RPC final answers may contain workspace information … |

Already-localized consent, review and authorization bodies (speech consent, group opt-in, owner confirmation, introduction/preview review) also stay unchanged in every locale; except for the [citations](citations.md), they are not on this list because they are already translated.

Values that are legitimately identical to English, such as fr "Message • {displayName}" or "({count} contacts)", are not fallbacks.

`docs/menu-diagrams.md` notes that these confirmations and the privacy notice stay English in every locale.
