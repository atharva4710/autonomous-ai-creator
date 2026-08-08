/**
 * Enforces schema validation rules on a Persona object.
 * Throws an Error with details if any rule is violated.
 */
export function validatePersona(persona: any): void {
  if (!persona || typeof persona !== 'object') {
    throw new Error('Persona must be a non-null object');
  }

  const {
    name,
    domain,
    role,
    description,
    interests,
    expertise,
    tone,
    editorialPrinciples,
  } = persona;

  // 1. Name Validation
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Persona name is required and must be a non-empty string.');
  }
  if (name.length > 100) {
    throw new Error('Persona name cannot exceed 100 characters.');
  }

  // 2. Domain Validation
  if (typeof domain !== 'string' || !domain.trim()) {
    throw new Error('Persona domain is required and must be a non-empty string.');
  }
  if (domain.length > 100) {
    throw new Error('Persona domain cannot exceed 100 characters.');
  }

  // 3. Optional string validations
  if (role !== undefined) {
    if (typeof role !== 'string') {
      throw new Error('Persona role must be a string.');
    }
    if (role.length > 150) {
      throw new Error('Persona role cannot exceed 150 characters.');
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      throw new Error('Persona description must be a string.');
    }
    if (description.length > 1000) {
      throw new Error('Persona description cannot exceed 1000 characters.');
    }
  }

  // 4. Helper for array validations
  const validateArray = (
    arrName: string,
    arr: any,
    maxSize = 15,
    maxStrSize = 100
  ) => {
    if (arr !== undefined) {
      if (!Array.isArray(arr)) {
        throw new Error(`Persona ${arrName} must be an array of strings.`);
      }
      if (arr.length > maxSize) {
        throw new Error(`Persona ${arrName} array size cannot exceed ${maxSize} items.`);
      }
      for (const item of arr) {
        if (typeof item !== 'string' || !item.trim()) {
          throw new Error(`Persona ${arrName} items must be non-empty strings.`);
        }
        if (item.length > maxStrSize) {
          throw new Error(`Persona ${arrName} items cannot exceed ${maxStrSize} characters.`);
        }
      }
    }
  };

  validateArray('interests', interests, 15, 100);
  validateArray('expertise', expertise, 15, 100);
  validateArray('tone', tone, 15, 100);
  validateArray('editorialPrinciples', editorialPrinciples, 15, 200);
}
