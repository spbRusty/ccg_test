document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row'); // Получаем все ряды

    // Создаем игроков
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    // Создаем колоду и добавляем карты (12 карт)
    const deck = new Deck();
    deck.addCard(new Card('Masik', 5));
    deck.addCard(new Card('Tubik', 3));
    deck.addCard(new Card('Skuf', 4));
    deck.addCard(new Card('Altushka', 7));
    deck.addCard(new Card('Sheikh', 6));
    deck.addCard(new Card('Alkash', 4));
    deck.addCard(new Card('ITishnik', 6));
    deck.addCard(new Card('Fifa', 5));
    deck.addCard(new Card('Vaper', 3));
    deck.addCard(new Card('TikToker', 4));
    deck.addCard(new Card('Khalif', 6));
    deck.addCard(new Card('GameDev', 8));
    deck.shuffle();

    // Игроки берут по 6 карт
    for (let i = 0; i < 6; i++) {
        player1.drawCard(deck);
        player2.drawCard(deck);
    }

    // Рендеринг карт
    let cardIndex = 0;

    rows.forEach((row, rowIndex) => {
        console.log(`Рендеринг для ряда ${rowIndex + 1}`);
        for (let i = 0; i < 3; i++) {
            if (rowIndex < 2) {
                if (player1.hand[cardIndex]) {
                    console.log(`Добавление карты ${player1.hand[cardIndex].name} для Player 1 в ряд ${rowIndex + 1}`);
                    row.appendChild(player1.hand[cardIndex].render());
                }
            } else {
                if (player2.hand[cardIndex - 6]) {
                    console.log(`Добавление карты ${player2.hand[cardIndex - 6].name} для Player 2 в ряд ${rowIndex + 1}`);
                    row.appendChild(player2.hand[cardIndex - 6].render());
                }
            }
            cardIndex++;
        }
    });
});
