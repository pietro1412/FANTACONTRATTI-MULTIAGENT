import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// Default categories to create for each league
// Colors must match frontend CATEGORY_COLORS keys: red, orange, yellow, green, blue, purple, pink, cyan, gray
const DEFAULT_CATEGORIES = [
  {
    name: 'Target',
    description: 'Giocatori da puntare assolutamente',
    icon: '🎯',
    color: 'red',
    sortOrder: 1,
  },
  {
    name: 'Osservati',
    description: 'Giocatori da monitorare',
    icon: '👁️',
    color: 'yellow',
    sortOrder: 2,
  },
  {
    name: 'Affari',
    description: 'Potenziali buoni acquisti',
    icon: '💰',
    color: 'green',
    sortOrder: 3,
  },
  {
    name: 'Scambi',
    description: 'Giocatori per proporre scambi',
    icon: '🔄',
    color: 'blue',
    sortOrder: 4,
  },
  {
    name: 'Da Cedere',
    description: 'Giocatori propri da cedere',
    icon: '📤',
    color: 'gray',
    sortOrder: 5,
  },
]

// ==================== CREATE DEFAULT CATEGORIES ====================

export async function createDefaultCategories(leagueId: string): Promise<ServiceResult> {
  try {
    // Check if league exists
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    })

    if (!league) {
      return { success: false, message: 'Lega non trovata' }
    }

    // Check if categories already exist
    const existingCategories = await prisma.watchlistCategory.findMany({
      where: { leagueId },
    })

    if (existingCategories.length > 0) {
      return { success: false, message: 'Le categorie esistono gia\' per questa lega' }
    }

    // Create default categories
    const created = await prisma.watchlistCategory.createMany({
      data: DEFAULT_CATEGORIES.map(cat => ({
        leagueId,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isSystemDefault: true,
      })),
    })

    return {
      success: true,
      message: String(created.count) + ' categorie create',
      data: { count: created.count },
    }
  } catch (error) {
    console.error('Error creating default categories:', error)
    return { success: false, message: 'Errore nella creazione delle categorie' }
  }
}

// ==================== GET CATEGORIES ====================

export async function getCategories(
  leagueId: string,
  memberId: string
): Promise<ServiceResult> {
  try {
    // Verify member belongs to league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        leagueId,
        status: 'ACTIVE',
      },
    })

    if (!member) {
      return { success: false, message: 'Non sei membro di questa lega' }
    }

    // Get categories with entry counts for this member
    // Prisma's _count doesn't support nested where, so we get entries and count manually
    let categories = await prisma.watchlistCategory.findMany({
      where: { leagueId },
      include: {
        entries: {
          where: { memberId },
          select: { id: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Auto-create default categories if none exist
    if (categories.length === 0) {
      console.log(`[Watchlist] Auto-creating default categories for league ${leagueId}`)
      await prisma.watchlistCategory.createMany({
        data: DEFAULT_CATEGORIES.map(cat => ({
          leagueId,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
          isSystemDefault: true,
        })),
      })
      // Fetch again after creation
      categories = await prisma.watchlistCategory.findMany({
        where: { leagueId },
        include: {
          entries: {
            where: { memberId },
            select: { id: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })
    }

    return {
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        isSystemDefault: cat.isSystemDefault,
        sortOrder: cat.sortOrder,
        entryCount: cat.entries.length,
      })),
    }
  } catch (error) {
    console.error('Error getting categories:', error)
    return { success: false, message: 'Errore nel recupero delle categorie' }
  }
}

// ==================== CREATE CATEGORY ====================

export async function createCategory(
  leagueId: string,
  memberId: string,
  data: {
    name: string
    description?: string
    icon?: string
    color?: string
  }
): Promise<ServiceResult> {
  try {
    // Verify member is admin of league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        leagueId,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    })

    if (!member) {
      return { success: false, message: 'Solo gli admin possono creare categorie' }
    }

    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      return { success: false, message: 'Il nome e\' obbligatorio' }
    }

    if (data.name.length > 50) {
      return { success: false, message: 'Il nome non puo\' superare i 50 caratteri' }
    }

    // Check for duplicate name
    const existing = await prisma.watchlistCategory.findFirst({
      where: {
        leagueId,
        name: data.name.trim(),
      },
    })

    if (existing) {
      return { success: false, message: 'Esiste gia\' una categoria con questo nome' }
    }

    // Get max sort order
    const maxOrder = await prisma.watchlistCategory.aggregate({
      where: { leagueId },
      _max: { sortOrder: true },
    })

    const category = await prisma.watchlistCategory.create({
      data: {
        leagueId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || null,
        color: data.color || null,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        isSystemDefault: false,
      },
    })

    return {
      success: true,
      message: 'Categoria creata',
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
        isSystemDefault: category.isSystemDefault,
        sortOrder: category.sortOrder,
      },
    }
  } catch (error) {
    console.error('Error creating category:', error)
    return { success: false, message: 'Errore nella creazione della categoria' }
  }
}

// ==================== UPDATE CATEGORY ====================

export async function updateCategory(
  categoryId: string,
  memberId: string,
  data: {
    name?: string
    description?: string
    icon?: string
    color?: string
    sortOrder?: number
  }
): Promise<ServiceResult> {
  try {
    // Get category and verify permissions
    const category = await prisma.watchlistCategory.findUnique({
      where: { id: categoryId },
      include: { league: true },
    })

    if (!category) {
      return { success: false, message: 'Categoria non trovata' }
    }

    // Verify member is admin of league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        leagueId: category.leagueId,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    })

    if (!member) {
      return { success: false, message: 'Solo gli admin possono modificare le categorie' }
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        return { success: false, message: 'Il nome e\' obbligatorio' }
      }

      if (data.name.length > 50) {
        return { success: false, message: 'Il nome non puo\' superare i 50 caratteri' }
      }

      // Check for duplicate name (excluding current category)
      const existing = await prisma.watchlistCategory.findFirst({
        where: {
          leagueId: category.leagueId,
          name: data.name.trim(),
          id: { not: categoryId },
        },
      })

      if (existing) {
        return { success: false, message: 'Esiste gia\' una categoria con questo nome' }
      }
    }

    const updated = await prisma.watchlistCategory.update({
      where: { id: categoryId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
      },
    })

    return {
      success: true,
      message: 'Categoria aggiornata',
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        icon: updated.icon,
        color: updated.color,
        isSystemDefault: updated.isSystemDefault,
        sortOrder: updated.sortOrder,
      },
    }
  } catch (error) {
    console.error('Error updating category:', error)
    return { success: false, message: 'Errore nell\'aggiornamento della categoria' }
  }
}

// ==================== DELETE CATEGORY ====================

export async function deleteCategory(
  categoryId: string,
  memberId: string
): Promise<ServiceResult> {
  try {
    // Get category
    const category = await prisma.watchlistCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return { success: false, message: 'Categoria non trovata' }
    }

    // Cannot delete system default categories
    if (category.isSystemDefault) {
      return { success: false, message: 'Non puoi eliminare le categorie di sistema' }
    }

    // Verify member is admin of league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        leagueId: category.leagueId,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    })

    if (!member) {
      return { success: false, message: 'Solo gli admin possono eliminare le categorie' }
    }

    // Delete category (cascade will delete entries)
    await prisma.watchlistCategory.delete({
      where: { id: categoryId },
    })

    return {
      success: true,
      message: 'Categoria eliminata',
    }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { success: false, message: 'Errore nell\'eliminazione della categoria' }
  }
}

// ==================== GET ENTRIES ====================

export async function getEntries(
  memberId: string,
  categoryId?: string
): Promise<ServiceResult> {
  try {
    // Verify member exists and is active
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        status: 'ACTIVE',
      },
    })

    if (!member) {
      return { success: false, message: 'Membro non trovato' }
    }

    const where: { memberId: string; categoryId?: string } = { memberId }
    if (categoryId) {
      where.categoryId = categoryId
    }

    const entries = await prisma.watchlistEntry.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            team: true,
            position: true,
            quotation: true,
            apiFootballStats: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { addedAt: 'desc' },
      ],
    })

    return {
      success: true,
      data: entries.map(entry => ({
        id: entry.id,
        category: entry.category,
        player: entry.player,
        maxBid: entry.maxBid,
        targetPrice: entry.targetPrice,
        priority: entry.priority,
        notes: entry.notes,
        addedAt: entry.addedAt,
        updatedAt: entry.updatedAt,
      })),
    }
  } catch (error) {
    console.error('Error getting entries:', error)
    return { success: false, message: 'Errore nel recupero delle entry' }
  }
}

// ==================== ADD ENTRY ====================

export async function addEntry(
  categoryId: string,
  memberId: string,
  playerId: string,
  data: {
    maxBid?: number
    targetPrice?: number
    priority?: number
    notes?: string
  }
): Promise<ServiceResult> {
  try {
    // Verify category exists
    const category = await prisma.watchlistCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return { success: false, message: 'Categoria non trovata' }
    }

    // Verify member belongs to the league
    const member = await prisma.leagueMember.findFirst({
      where: {
        id: memberId,
        leagueId: category.leagueId,
        status: 'ACTIVE',
      },
    })

    if (!member) {
      return { success: false, message: 'Non sei membro di questa lega' }
    }

    // Verify player exists
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: playerId },
    })

    if (!player) {
      return { success: false, message: 'Giocatore non trovato' }
    }

    // Validate priority
    if (data.priority !== undefined && (data.priority < 1 || data.priority > 5)) {
      return { success: false, message: 'La priorita\' deve essere tra 1 e 5' }
    }

    // Check if player already in this category for this member
    const existing = await prisma.watchlistEntry.findFirst({
      where: {
        categoryId,
        memberId,
        playerId,
      },
    })

    if (existing) {
      return { success: false, message: 'Giocatore gia\' presente in questa categoria' }
    }

    const entry = await prisma.watchlistEntry.create({
      data: {
        categoryId,
        memberId,
        playerId,
        maxBid: data.maxBid || null,
        targetPrice: data.targetPrice || null,
        priority: data.priority || null,
        notes: data.notes?.trim() || null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            team: true,
            position: true,
            quotation: true,
          },
        },
      },
    })

    return {
      success: true,
      message: 'Giocatore aggiunto alla watchlist',
      data: {
        id: entry.id,
        category: entry.category,
        player: entry.player,
        maxBid: entry.maxBid,
        targetPrice: entry.targetPrice,
        priority: entry.priority,
        notes: entry.notes,
        addedAt: entry.addedAt,
      },
    }
  } catch (error) {
    console.error('Error adding entry:', error)
    return { success: false, message: 'Errore nell\'aggiunta del giocatore' }
  }
}

// ==================== UPDATE ENTRY ====================

export async function updateEntry(
  entryId: string,
  memberId: string,
  data: {
    maxBid?: number | null
    targetPrice?: number | null
    priority?: number | null
    notes?: string | null
  }
): Promise<ServiceResult> {
  try {
    // Get entry and verify ownership
    const entry = await prisma.watchlistEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry) {
      return { success: false, message: 'Entry non trovata' }
    }

    if (entry.memberId !== memberId) {
      return { success: false, message: 'Non autorizzato' }
    }

    // Validate priority if provided
    if (data.priority !== undefined && data.priority !== null) {
      if (data.priority < 1 || data.priority > 5) {
        return { success: false, message: 'La priorita\' deve essere tra 1 e 5' }
      }
    }

    const updated = await prisma.watchlistEntry.update({
      where: { id: entryId },
      data: {
        maxBid: data.maxBid,
        targetPrice: data.targetPrice,
        priority: data.priority,
        notes: data.notes?.trim(),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            team: true,
            position: true,
            quotation: true,
          },
        },
      },
    })

    return {
      success: true,
      message: 'Entry aggiornata',
      data: {
        id: updated.id,
        category: updated.category,
        player: updated.player,
        maxBid: updated.maxBid,
        targetPrice: updated.targetPrice,
        priority: updated.priority,
        notes: updated.notes,
        addedAt: updated.addedAt,
        updatedAt: updated.updatedAt,
      },
    }
  } catch (error) {
    console.error('Error updating entry:', error)
    return { success: false, message: 'Errore nell\'aggiornamento della entry' }
  }
}

// ==================== REMOVE ENTRY ====================

export async function removeEntry(
  entryId: string,
  memberId: string
): Promise<ServiceResult> {
  try {
    // Get entry and verify ownership
    const entry = await prisma.watchlistEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry) {
      return { success: false, message: 'Entry non trovata' }
    }

    if (entry.memberId !== memberId) {
      return { success: false, message: 'Non autorizzato' }
    }

    await prisma.watchlistEntry.delete({
      where: { id: entryId },
    })

    return {
      success: true,
      message: 'Giocatore rimosso dalla watchlist',
    }
  } catch (error) {
    console.error('Error removing entry:', error)
    return { success: false, message: 'Errore nella rimozione del giocatore' }
  }
}

// ==================== MOVE ENTRY ====================

export async function moveEntry(
  entryId: string,
  memberId: string,
  newCategoryId: string
): Promise<ServiceResult> {
  try {
    // Get entry and verify ownership
    const entry = await prisma.watchlistEntry.findUnique({
      where: { id: entryId },
      include: {
        category: true,
      },
    })

    if (!entry) {
      return { success: false, message: 'Entry non trovata' }
    }

    if (entry.memberId !== memberId) {
      return { success: false, message: 'Non autorizzato' }
    }

    // Verify new category exists and belongs to same league
    const newCategory = await prisma.watchlistCategory.findUnique({
      where: { id: newCategoryId },
    })

    if (!newCategory) {
      return { success: false, message: 'Categoria di destinazione non trovata' }
    }

    if (newCategory.leagueId !== entry.category.leagueId) {
      return { success: false, message: 'La categoria deve appartenere alla stessa lega' }
    }

    if (newCategoryId === entry.categoryId) {
      return { success: false, message: 'Il giocatore e\' gia\' in questa categoria' }
    }

    // Check if player already exists in target category
    const existingInTarget = await prisma.watchlistEntry.findFirst({
      where: {
        categoryId: newCategoryId,
        memberId,
        playerId: entry.playerId,
      },
    })

    if (existingInTarget) {
      return { success: false, message: 'Il giocatore e\' gia\' nella categoria di destinazione' }
    }

    // Move entry
    const updated = await prisma.watchlistEntry.update({
      where: { id: entryId },
      data: {
        categoryId: newCategoryId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            team: true,
            position: true,
            quotation: true,
          },
        },
      },
    })

    return {
      success: true,
      message: `Giocatore spostato in "${newCategory.name}"`,
      data: {
        id: updated.id,
        category: updated.category,
        player: updated.player,
        maxBid: updated.maxBid,
        targetPrice: updated.targetPrice,
        priority: updated.priority,
        notes: updated.notes,
      },
    }
  } catch (error) {
    console.error('Error moving entry:', error)
    return { success: false, message: 'Errore nello spostamento del giocatore' }
  }
}

// ==================== ENSURE DEFAULT CATEGORIES ====================

export async function ensureDefaultCategories(leagueId: string): Promise<ServiceResult> {
  try {
    // Check if categories exist
    const existingCount = await prisma.watchlistCategory.count({
      where: { leagueId },
    })

    if (existingCount > 0) {
      return {
        success: true,
        message: 'Categorie gia\' presenti',
        data: { created: false, count: existingCount },
      }
    }

    // Create default categories
    return await createDefaultCategories(leagueId)
  } catch (error) {
    console.error('Error ensuring default categories:', error)
    return { success: false, message: 'Errore nella verifica delle categorie' }
  }
}
