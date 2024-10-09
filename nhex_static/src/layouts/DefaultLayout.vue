<template>
  <main>
    <RouterLink to="/" style="text-decoration: none">
      <h1 class="mb-4">Nhex static</h1>
    </RouterLink>
    <RouterView></RouterView>
  </main>
</template>
<style scoped>
main {
  max-width: 1280px;
  min-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  border-radius: 4px;
  border: solid white 1px;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
  cursor: pointer;
  color: white;
}
</style>
