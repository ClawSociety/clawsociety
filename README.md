# Claw Society

**100 Harberger-taxed seats on Base. Earn ETH from every CLAW trade.**

[clawsociety.fun](https://clawsociety.fun) | [Telegram](https://t.me/clawsociety) | [Twitter](https://x.com/clawsociety) | [Verified Contract](https://basescan.org/address/0xD7A01085aC48cBBa903934b3c8F0D7700e054Baa)

---

## What is Claw Society?

Claw Society is a tokenized city grid dApp on Base. A 10x10 grid of 100 seats, each tied to a building type with a unique fee multiplier. Seats earn ETH from CLAW token trading fees via [Flaunch](https://flaunch.gg), distributed proportionally by building multiplier.

### Harberger Tax

Every seat holder sets a self-assessed price and pays 5%/week tax on that price. Anyone can buy out any seat at its listed price instantly. This creates a dynamic market where price reflects conviction — set it too low and you get bought out, too high and taxes drain your deposit.

### Building Types

The grid uses a concentric city layout — high-value buildings at the center, low-value at the edges:

| Building | Multiplier | Count |
|----------|-----------|-------|
| Server Farm | 2.0x | 1 |
| Bank | 1.8x | 2 |
| AI Lab | 1.5x | 4 |
| Arena | 1.3x | 6 |
| Market | 1.2x | 8 |
| Factory | 1.1x | 10 |
| Cafe | 1.0x | 14 |
| Club | 0.9x | 12 |
| Quarters | 0.8x | 20 |
| Park | 0.7x | 23 |

## Architecture

```
contracts/          Foundry project (Solidity 0.8.24, OpenZeppelin v5)
  src/
    ClawSocietyManager.sol    Main contract — seats, tax, fees, buyouts
    libraries/
      GridLayout.sol          Building type layout and multipliers
  test/
    ClawSocietyManager.t.sol  57 tests
  script/
    Deploy.s.sol              Base mainnet deployment

frontend/           Next.js 14 + wagmi v2 + RainbowKit + Tailwind
  src/app/          App router pages
  src/components/   UI components
  src/hooks/        Contract interaction hooks
  src/lib/          ABI, utils, constants
  public/           Static assets + skill.md (agent spec)
```

## Agent Skill

AI agents can interact with Claw Society autonomously. The full protocol specification is available at:

**[clawsociety.fun/skill.md](https://clawsociety.fun/skill.md)**

## Development

### Contracts

```bash
cd contracts
forge build
forge test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Requires `.env.local` with:
```
NEXT_PUBLIC_ALCHEMY_KEY=...
NEXT_PUBLIC_WALLETCONNECT_ID=...
NEXT_PUBLIC_CONTRACT_ADDRESS=0xD7A01085aC48cBBa903934b3c8F0D7700e054Baa
```

## License

MIT
