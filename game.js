document.addEventListener('DOMContentLoaded', () => {
    const opponentHand = document.querySelector('.opponent-hand');
    const playerHand = document.querySelector('.player-hand');
    const rows = document.querySelectorAll('.row');

    // Создаем игроков
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    // Создаем колоду и добавляем карты
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

    // Игроки берут по 5 карт
    for (let i = 0; i < 5; i++) {
        player1.drawCard(deck);
        player2.drawCard(deck);
    }

    // Рендеринг карт в руках игроков
    player1.hand.forEach(card => {
        const cardElement = card.render();
        cardElement.draggable = true;
        addDragAndDropListeners(cardElement);
        playerHand.appendChild(cardElement);
    });

    player2.hand.forEach(card => {
        const cardElement = card.render();
        cardElement.draggable = true;
        addDragAndDropListeners(cardElement);
        opponentHand.appendChild(cardElement);
    });

    // Добавление слушателей событий для перетаскивания
    function addDragAndDropListeners(cardElement) {
        cardElement.addEventListener('dragstart', (event) => {
            cardElement.classList.add('dragging');
            event.dataTransfer.setData('text/plain', event.target.id);
        });

        cardElement.addEventListener('dragend', () => {
            cardElement.classList.remove('dragging');
        });
    }

    rows.forEach(row => {
        row.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        row.addEventListener('drop', (event) => {
            event.preventDefault();
            const cardId = event.dataTransfer.getData('text/plain');
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                row.appendChild(cardElement);
            }
        });
    });
});
