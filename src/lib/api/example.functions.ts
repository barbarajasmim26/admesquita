export const getGreeting = async (data: { name: string }) => {
  return {
    greeting: `Hello, ${data.name}!`,
    mode: "spa",
  };
};
