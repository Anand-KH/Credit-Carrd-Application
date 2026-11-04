export function calculateAge(dateOfBirth, asOf = new Date()) {
  const birthDate = new Date(dateOfBirth);
  const currentDate = new Date(asOf);
  let age = currentDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayNotReached = (
    currentDate.getUTCMonth() < birthDate.getUTCMonth()
    || (
      currentDate.getUTCMonth() === birthDate.getUTCMonth()
      && currentDate.getUTCDate() < birthDate.getUTCDate()
    )
  );
  if (birthdayNotReached) {
    age -= 1;
  }
  return age;
}

export function isAtLeastAge(dateOfBirth, minimumAge, asOf = new Date()) {
  return calculateAge(dateOfBirth, asOf) >= minimumAge;
}

export function isOlderThanAge(dateOfBirth, age, asOf = new Date()) {
  return calculateAge(dateOfBirth, asOf) > age;
}

export function subtractMonths(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}
