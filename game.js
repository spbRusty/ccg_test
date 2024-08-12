document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row'); // Получаем все ряды

    // Создаем игроков
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    // Создаем колоду и добавляем карты
    const deck = new Deck();
    const cardsData = [
        { name: 'Masik', value: 5 },
        { name: 'Tubik', value: 3 },
        { name: 'Skuf', value: 4 },
        { name: 'Altushka', value: 7 },
        { name: 'Sheikh', value: 6 },
        { name: 'Alkash', value: 4 },
        { name: 'ITishnik', value: 6 },
        { name: 'Fifa', value: 5 },
        { name: 'Vaper', value: 3 },
        { name: 'TikToker', value: 4 },
        { name: 'Khalif', value: 6 },
        { name: 'GameDev', value: 8 },
    ];

    cardsData.forEach(card => deck.addCard(new Card(card.name, card.value)));
    deck.shuffle();

    // Игроки берут по 6 карт
    for (let i = 0; i < 6; i++) {
        player1.drawCard(deck);
        player2.drawCard(deck);
    }

    // Рендеринг карт
    const totalCards = 6;
    for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
        const row = rows[rowIndex];
        for (let i = 0; i < 3; i++) {
            let card;
            if (rowIndex < 2) { 
                card = player2.hand[rowIndex * 3 + i];
            } else {
                card = player1.hand[(rowIndex - 2) * 3 + i];
            }
            if (card) {
                row.appendChild(card.render());
            }
        }
    }
});

// Определение класса Card
class Card {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }

    render() {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.textContent = `${this.name} (${this.value})`;
        return cardElement;
    }
}

// Определение класса Deck
class Deck {
    constructor() {
        this.cards = [];
    }

    addCard(card) {
        this.cards.push(card);
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    drawCard() {
        return this.cards.pop();
    }
}

// Определение класса Player
class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
    }

    drawCard(deck) {
        const card = deck.drawCard();
        if (card) {
            this.hand.push(card);
        }
    }
}
