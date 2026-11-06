# ENSv2 Enhanced Access Control (EAC) & Permissions

## Role Separation Model

1. **Treasury Role**:
   - May propose rotations (`pendingPayTo`).
   - Cannot directly modify `activePayTo`.
2. **Controller Role (`RotationController.sol`)**:
   - The *only* address authorized to update `activePayTo` on the ENS profile.
   - Enforces the mandatory timelock delay (e.g. 90 seconds demo delay).
   - Requires authorization check (e.g. World ID Agent Pass validated approval).
3. **Owner Role**:
   - Controls top-level ENS node records.

## Prototype Trust Assumptions
In local and hackathon prototype configurations where full on-chain EAC contracts are simulated, off-chain backend checks enforce the controller rules while maintaining strict interface parity.
