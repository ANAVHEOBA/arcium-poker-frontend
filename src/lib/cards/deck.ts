/**
 * Arcium Poker - Deck Management
 * 
 * Standard 52-card deck management.
 */

/**
 * Card suits
 */
export enum Suit {
  Hearts = 'Hearts',
  Diamonds = 'Diamonds',
  Clubs = 'Clubs',
  Spades = 'Spades',
}

/**
 * Card ranks
 */
export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

/**
 * Card representation
 */
export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // Numeric value for comparison
}

/**
 * Deck Manager
 * Manages standard 52-card deck
 */
export class DeckManager {
  private static readonly SUITS = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  private static readonly RANKS = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
    Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];

  /**
   * Create a standard 52-card deck
   * 
   * @returns Array of 52 cards
   */
  static createDeck(): Card[] {
    const deck: Card[] = [];
    
    for (const suit of this.SUITS) {
      for (let i = 0; i < this.RANKS.length; i++) {
        deck.push({
          suit,
          rank: this.RANKS[i],
          value: i + 2, // 2-14 (Ace high)
        });
      }
    }
    
    return deck;
  }

  /**
   * Shuffle a deck (Fisher-Yates algorithm)
   * Note: In production, this would use MPC shuffle
   * 
   * @param deck - Deck to shuffle
   * @returns Shuffled deck
   */
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  /**
   * Get card from encoded value
   * 
   * @param encoded - Encoded card value (0-51)
   * @returns Card
   */
  static decodeCard(encoded: number): Card | null {
    if (encoded < 0 || encoded >= 52) return null;
    
    const suitIndex = Math.floor(encoded / 13);
    const rankIndex = encoded % 13;
    
    return {
      suit: this.SUITS[suitIndex],
      rank: this.RANKS[rankIndex],
      value: rankIndex + 2,
    };
  }

  /**
   * Encode card to numeric value
   * 
   * @param card - Card to encode
   * @returns Encoded value (0-51)
   */
  static encodeCard(card: Card): number {
    const suitIndex = this.SUITS.indexOf(card.suit);
    const rankIndex = this.RANKS.indexOf(card.rank);
    return suitIndex * 13 + rankIndex;
  }

  /**
   * Get card display string
   * 
   * @param card - Card
   * @returns Display string (e.g., "A♠")
   */
  static getCardDisplay(card: Card): string {
    const suitSymbols = {
      [Suit.Hearts]: '♥',
      [Suit.Diamonds]: '♦',
      [Suit.Clubs]: '♣',
      [Suit.Spades]: '♠',
    };
    
    return `${card.rank}${suitSymbols[card.suit]}`;
  }

  /**
   * Get rank value
   * 
   * @param rank - Card rank
   * @returns Numeric value (2-14)
   */
  static getRankValue(rank: Rank): number {
    return this.RANKS.indexOf(rank) + 2;
  }

  /**
   * Compare two cards by rank
   * 
   * @param card1 - First card
   * @param card2 - Second card
   * @returns -1 if card1 < card2, 0 if equal, 1 if card1 > card2
   */
  static compareCards(card1: Card, card2: Card): number {
    if (card1.value < card2.value) return -1;
    if (card1.value > card2.value) return 1;
    return 0;
  }

  /**
   * Sort cards by rank (descending)
   * 
   * @param cards - Cards to sort
   * @returns Sorted cards
   */
  static sortCards(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => b.value - a.value);
  }

  /**
   * Check if card is face card
   * 
   * @param card - Card to check
   * @returns True if face card (J, Q, K)
   */
  static isFaceCard(card: Card): boolean {
    return [Rank.Jack, Rank.Queen, Rank.King].includes(card.rank);
  }

  /**
   * Check if card is ace
   * 
   * @param card - Card to check
   * @returns True if ace
   */
  static isAce(card: Card): boolean {
    return card.rank === Rank.Ace;
  }

  /**
   * Get all cards of a specific suit from deck
   * 
   * @param deck - Deck of cards
   * @param suit - Suit to filter
   * @returns Cards of specified suit
   */
  static getCardsBySuit(deck: Card[], suit: Suit): Card[] {
    return deck.filter(card => card.suit === suit);
  }

  /**
   * Get all cards of a specific rank from deck
   * 
   * @param deck - Deck of cards
   * @param rank - Rank to filter
   * @returns Cards of specified rank
   */
  static getCardsByRank(deck: Card[], rank: Rank): Card[] {
    return deck.filter(card => card.rank === rank);
  }

  /**
   * Deal cards from deck
   * 
   * @param deck - Deck to deal from
   * @param count - Number of cards to deal
   * @returns Object with dealt cards and remaining deck
   */
  static dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
    const dealt = deck.slice(0, count);
    const remaining = deck.slice(count);
    return { dealt, remaining };
  }

  /**
   * Get card display string from index (0-51)
   * 
   * @param index - Card index (0-51)
   * @returns Display string (e.g., "A♠") or "?" for invalid
   */
  static getCardDisplayFromIndex(index: number): string {
    const card = this.decodeCard(index);
    if (!card) return '?';
    return this.getCardDisplay(card);
  }

  /**
   * Get card color from index (for styling)
   * 
   * @param index - Card index (0-51)
   * @returns 'red' for hearts/diamonds, 'black' for clubs/spades
   */
  static getCardColorFromIndex(index: number): 'red' | 'black' {
    const card = this.decodeCard(index);
    if (!card) return 'black';
    return [Suit.Hearts, Suit.Diamonds].includes(card.suit) ? 'red' : 'black';
  }

  /**
   * Get full card object from index with display properties
   * 
   * @param index - Card index (0-51)
   * @returns Card info with display properties
   */
  static getCardInfoFromIndex(index: number): { 
    card: Card | null; 
    display: string; 
    color: 'red' | 'black';
    isValid: boolean;
  } {
    const card = this.decodeCard(index);
    return {
      card,
      display: card ? this.getCardDisplay(card) : '?',
      color: card && [Suit.Hearts, Suit.Diamonds].includes(card.suit) ? 'red' : 'black',
      isValid: card !== null
    };
  }
}
