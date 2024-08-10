class Card {
    constructor(name, power) {
        this.name = name;
        this.power = power;
    }

    render() {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.textContent = `${this.name} (${this.power})`;
        return cardElement;
    }
}
