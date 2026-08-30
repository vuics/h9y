export const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    )
}

export const validatePhone = (phone) => {
  return String(phone).match(/^\+(?:[0-9] ?){6,14}[0-9]$/)
}

export const validatePassword = (password) => {

  // https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
  const pw = String(password)
  return {
    valid: pw.match(
      /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/
    ),

    // At least one upper case English letter
    upperCase: pw.match(/(?=.*?[A-Z])/),

    // At least one lower case English letter
    lowerCase: pw.match(/(?=.*?[a-z])/),

    // At least one digit
    digit: pw.match(/(?=.*?[0-9])/),

    // At least one special character
    special: pw.match(/(?=.*?[#?!@$%^&*-])/),

    // Minimum eight in length (with the anchors)
    length: pw.match(/.{8,}/),
  }
}

// NOTE: The token is generated in /forgot as randomBytes(32).toString('hex'),
//       so it is always 64 hex characters. Checking the shape rather than the
//       length keeps non-string bodies, such as `{"token": {"$ne": null}}`,
//       out of the database query.
export const validateResetToken = (token) => {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)
}
