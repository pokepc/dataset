import type { ZodType } from 'zod'

type ValidationResult = {
  success: boolean
  errors: string[]
  errorsSummary: string[]
}

export function validate(schema: ZodType, data: any, maxErrors = 5): ValidationResult {
  const _validateSchema = () => {
    const errors: string[] = []
    const parsed = schema.safeParse(data)
    const errorMsg = parsed.success ? '' : String(parsed.error)
    if (!parsed.success) {
      errors.push(errorMsg)
    }

    return errors
  }

  const _errors = _validateSchema()
  const _errorMessages: string[] = []

  if (_errors.length > 0) {
    _errors.every((err, i) => {
      const errNo = i + 1
      _errorMessages.push(err)

      if (errNo === maxErrors) {
        const remainingErrors = _errors.length - errNo
        _errorMessages.push(`  ... and other ${remainingErrors} errors`)
      }

      return i <= maxErrors
    })
  }

  return {
    success: _errors.length === 0,
    errors: _errors,
    errorsSummary: _errorMessages,
  }
}
