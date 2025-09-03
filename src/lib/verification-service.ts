// In-memory storage for verification codes
// In production, this should be replaced with Redis or a database
class VerificationCodeStorage {
  private codes = new Map<string, { code: string, expires: number }>()

  // Generate 6-digit verification code
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Store verification code
  storeCode(phoneNumber: string, code: string, expirationMinutes: number = 10): void {
    const expires = Date.now() + expirationMinutes * 60 * 1000
    this.codes.set(phoneNumber, { code, expires })
    console.log(`Stored verification code for ${phoneNumber}, expires in ${expirationMinutes} minutes`)
  }

  // Get verification code
  getCode(phoneNumber: string): { code: string, expires: number } | null {
    this.cleanExpiredCodes()
    return this.codes.get(phoneNumber) || null
  }

  // Verify and remove code
  verifyAndRemoveCode(phoneNumber: string, inputCode: string): boolean {
    this.cleanExpiredCodes()
    
    const storedData = this.codes.get(phoneNumber)
    if (!storedData) {
      return false
    }

    if (storedData.expires < Date.now()) {
      this.codes.delete(phoneNumber)
      return false
    }

    if (storedData.code !== inputCode) {
      return false
    }

    // Code is valid - remove it
    this.codes.delete(phoneNumber)
    return true
  }

  // Clean expired codes
  private cleanExpiredCodes(): void {
    const now = Date.now()
    for (const [phone, data] of this.codes.entries()) {
      if (data.expires < now) {
        this.codes.delete(phone)
      }
    }
  }

  // Get all stored codes (for debugging)
  getAllCodes(): Map<string, { code: string, expires: number }> {
    this.cleanExpiredCodes()
    return new Map(this.codes)
  }
}

// Export singleton instance
export const verificationStorage = new VerificationCodeStorage()