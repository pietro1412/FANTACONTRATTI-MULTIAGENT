# Skill: Convenzioni Codice FantaContratti

> Pattern e convenzioni del codebase. Da seguire per ogni modifica.

## Componenti React — Pattern Standard

```tsx
// src/components/feature-name/ComponentName.tsx
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { contractApi } from '@/services/api';
import type { Contract } from '@/types/contract.types';

interface ComponentNameProps {
  contract: Contract;
  onAction?: (id: string) => void;
}

export default function ComponentName({ contract, onAction }: ComponentNameProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await contractApi.renew(contract.id, { /* ... */ });
      if (!response.success) {
        setError(response.message || 'Errore durante l\'operazione');
        return;
      }
      onAction?.(contract.id);
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-gray-900 p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {/* ... */}
    </div>
  );
}
```

## Service Layer — Pattern Standard

```typescript
// src/services/example.service.ts
import { prisma } from '@/lib/prisma';
import type { ServiceResult } from '@/shared/types';  // ← tipo condiviso, MAI ridichiarare

export async function doSomething(
  leagueId: string,
  userId: string,
  input: SomeInput
): Promise<ServiceResult> {
  try {
    // 1. Validazione
    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    });
    if (!member) {
      return { success: false, message: 'Non sei membro di questa lega' };
    }

    // 2. Business logic
    const result = await prisma.$transaction(async (tx) => {
      // ... operazioni atomiche
    });

    // 3. Risposta
    return { success: true, data: result };
  } catch (error) {
    // NO console.log — solo in dev
    return { success: false, message: 'Errore interno del server' };
  }
}
```

## Route Handler — Pattern Standard

```typescript
// src/api/routes/example.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/:leagueId/data', authMiddleware, async (req, res) => {
  try {
    const result = await someService.getData(req.params.leagueId, req.user!.id);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore interno del server' });
  }
});

export default router;
```

## Import Path

```typescript
// ✅ CORRETTO — alias @/ per nuovo codice
import { contractApi } from '@/services/api';
import type { Contract } from '@/types/contract.types';

// ❌ EVITARE — path relativi profondi
import { contractApi } from '../../../services/api';
```

## Prisma Schema

Modifiche allo schema:
1. Editare il file corretto in `prisma/schemas/` (non schema.generated.prisma)
2. `npm run db:build-schema` per rigenerare il merge
3. `npm run db:generate` per aggiornare il client
4. `npm run db:push` o `npm run db:migrate` per applicare

## Test — Pattern

```typescript
// tests/unit/contract-formulas.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRescissionClause, calculateDefaultSalary } from '@/services/contract.service';

describe('Contract Formulas', () => {
  describe('calculateRescissionClause', () => {
    it('should apply x3 multiplier for 1 semester', () => {
      expect(calculateRescissionClause(10, 1)).toBe(30);
    });

    it('should apply x11 multiplier for 4 semesters', () => {
      expect(calculateRescissionClause(10, 4)).toBe(110);
    });
  });

  describe('calculateDefaultSalary', () => {
    it('should be 10% of auction price, minimum 1', () => {
      expect(calculateDefaultSalary(100)).toBe(10);
      expect(calculateDefaultSalary(5)).toBe(1);  // minimum
    });
  });
});
```
