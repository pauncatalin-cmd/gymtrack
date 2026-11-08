GymTrack Full Body

Fără zile fixe. Full Body bazat în principal pe aparate cu selector de greutate cu cui. Poți marca aparatele ocupate, completa kg/repetări, folosi timerul și urmări istoricul.

## v4
- Corectează calculul volumului: orice serie cu kg și repetări valide este inclusă.
- Repară automat volumele istorice recalculabile fără să șteargă fb-history.
- Păstrează istoricul și progresul existent din localStorage.

## Backup și actualizare pe iPhone

1. Deschide aplicația din locul în care vezi istoricul, de exemplu din iconița deja instalată. În **Istoric**, apasă **Exportă backup** și salvează fișierul JSON în **Fișiere**. Verifică dacă îl găsești acolo și notează numărul de antrenamente. Exportul din versiunea precedentă include istoricul, ciorna și ora de pornire. Dacă ai un antrenament în curs, salvează-l înainte de exportul din versiunea veche.
2. După publicarea update-ului, închide și redeschide aplicația de la aceeași adresă. Verifică numărul de antrenamente, programele și, dacă este cazul, opțiunea **Continuă antrenamentul**.
3. În versiunea nouă, apasă rotița **Setări** din dreapta sus și alege **Exportă backup**. Pe un alt telefon sau la altă adresă, folosește **Istoric → Importă backup** și verifică rezultatul. Pe iPhone, Safari și aplicația instalată pot avea istorice separate.

Versiunea nouă citește automat `fb-history` și istoricul din vechea cheie `gymtrack-history`. La prima salvare scrie datele într-o singură înregistrare versionată și păstrează cheile originale. Backupul nou include istoricul complet, programele, programul selectat, ciorna, ora de pornire și datele istorice arhivate.

Importul acceptă noul format, exporturile KIP v10 și GymTrack v1 și listele JSON de antrenamente. Adaugă sesiunile lipsă și păstrează versiunile diferite ale aceleiași sesiuni, pentru verificare. Programele cu același ID și conținut diferit sunt păstrate separat. Dacă ambele dispozitive au câte o ciornă diferită, salvează antrenamentul de pe dispozitivul de destinație înainte de import. Ciornele din exporturile v10 sunt arhivate pentru recuperare manuală, deoarece fișierul vechi nu identifică programul lor.

Un fișier de recuperare din capturi poate include un rezumat al perioadei anterioare. Totalurile și progresul sunt afișate împreună cu sesiunile înregistrate după capturi. Calendarul și istoricul afișează sesiunile cu date cunoscute. Rezumatul intră în exporturile ulterioare.

## Antrenamente și progres

- Aparatele de forță pornesc de la 5 serii și 50 kg orientativ. Actualizarea aplică valorile programelor existente după încheierea unei sesiuni în curs. Valorile anterioare sunt păstrate în arhiva exportului.
- În antrenament, **Preia valorile de data trecută** completează câmpurile libere din seriile bifate anterior. Seriile precompletate intră în istoric după ce le bifezi.
- Deasupra câmpurilor pentru serii, fiecare aparat afișează **Prima performanță** și **Ultima performanță**, inclusiv valorile recuperate din capturi.
- **Istoric** permite filtrarea după program și interval și afișarea tuturor paginilor. **Fișă de progres** arată cea mai bună serie pe sesiune, recordul disponibil și valorile păstrate din capturi.
- În **Setări → Obiectiv și greutate** poți seta obiectivul săptămânal și salva măsurători de greutate. Ambele sunt incluse în backup.
- **Rezumatul de la final** afișează durata, volumul, comparația cu ultima sesiune din program, recordurile noi și caloriile active estimate. Estimarea folosește ultima greutate disponibilă, timpul cronometrat și, dacă ai bifat cardio, minutele și ritmul introduse. Estimările se însumează pe săptămână pentru sesiunile care au o valoare salvată. Valorile MET sunt din [Compendium of Physical Activities](https://pacompendium.com/adult-compendium/).
- În **Programe & aparate**, săgețile schimbă ordinea exercițiilor. Câmpul **Pauză (sec)** controlează cronometrul după bifarea unei serii. Valoarea 0 dezactivează pauza automată pentru acel aparat.

Pentru dezvoltare, rulează `node --test` pentru verificarea compatibilității backupului și a migrării.
