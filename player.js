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

    playCard(index) {
        if (index < this.hand.length) {
            return this.hand.splice(index, 1)[0];
        }
        return null;
    }
}
