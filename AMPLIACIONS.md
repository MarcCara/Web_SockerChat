# Ampliació 1: recuperació de missatges

El servidor activa `connectionStateRecovery` durant dos minuts. El client mostra
el resultat de `socket.recovered` després d'una reconnexió. El botó «Simular
tall del transport» tanca el transport Engine.IO; no és una desconnexió
voluntària i la reconnexió automàtica continua activa.

Per comparar el comportament sense recuperació, inicieu el servidor a PowerShell
amb:

```powershell
$env:SOCKET_RECOVERY_ENABLED = 'false'
npm start
```

Per tornar a activar-la en el mateix terminal:

```powershell
Remove-Item Env:\SOCKET_RECOVERY_ENABLED
npm start
```

## Prova amb dues pestanyes

1. Entreu al xat amb un nom a les pestanyes A i B i comproveu que totes dues
   reben un missatge inicial.
2. Premeu «Simular tall del transport» a A. Sense tancar ni recarregar la
   pestanya, envieu dos missatges des de B abans que A es reconnecti.
3. Repetiu la prova amb recuperació activada i desactivada.
4. Amb recuperació activada, repetiu el tall i reinicieu el servidor abans de
   la reconnexió. L'adaptador en memòria no conserva l'estat en reiniciar-lo.

| Escenari | `socket.recovered` | Missatges enviats durant el tall |
| --- | --- | --- |
| Sense recuperació | `false` | No arriben a A |
| Recuperació activada, mateixa instància | `true` | Arriben a A en reconnectar |
| Servidor reiniciat durant el tall | `false` | No es recupera l'estat anterior |

Per al lliurament, enregistreu un vídeo addicional que mostri les dues pestanyes,
el tall, els missatges pendents i el resultat de recuperació.

## Ampliació 2: sales i participants

El servidor crea codis de sis caràcters, gestiona la pertinença amb Socket.IO
rooms, i envia missatges i llistes de participants només a la sala corresponent.
Quan l'últim participant surt o es desconnecta, la sala queda buida i el codi
deixa d'existir; qualsevol codi nou generat es pot tornar a utilitzar.

Comprovació manual amb tres pestanyes:

1. Creeu una sala a la pestanya A i una altra a la pestanya C.
2. Uniu la pestanya B a la sala d'A. Envieu missatges a les dues sales i
   verifiqueu que no es barregen.
3. Abandoneu la sala des de B o tanqueu la pestanya i comproveu que la llista
   d'A s'actualitza.
4. Proveu un codi inexistent i proveu d'enviar sense haver entrat en una sala.

## Escalat horitzontal

La versió de clúster desactiva la recuperació (no és compatible amb
`@socket.io/cluster-adapter`) i inicia un worker al port 3000 i un altre al
3001. Inicieu-la amb:

```powershell
npm run start:cluster
```

Obriu una pestanya a `http://localhost:3000` i una altra a
`http://localhost:3001`. Creeu una sala en una i uniu l'altra amb el codi;
envieu missatges en tots dos sentits. El terminal indica el PID de cada worker.
L'adaptador de clúster propaga les operacions de Socket.IO entre processos, que
altrament no comparteixen ni la memòria de les sales ni la dels sockets.

Per a l'evidència de lliurament, captureu les dues pestanyes connectades a ports
diferents i el terminal amb els PID dels dos processos.

Per comparar-ho sense l'adaptador:

```powershell
npm run start:cluster:no-adapter
```

Sense l'adaptador, els processos no comparteixen les sales: un codi creat al
port 3000 no existeix al port 3001. Amb `npm run start:cluster`, la sala i els
missatges es propaguen als dos workers.
