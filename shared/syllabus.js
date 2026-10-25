export const syllabusUrl =
  "https://gate2027.iitm.ac.in/static/doc/GATE2027_Syllabus/DA_GATE2027_Syllabus.pdf";
export const subjects = [
  {
    id: "probability",
    name: "Probability & Statistics",
    icon: "σ",
    topics: [
      "Counting, permutations and combinations",
      "Probability axioms, sample spaces and events",
      "Independent and mutually exclusive events",
      "Marginal, conditional and joint probability",
      "Bayes theorem",
      "Conditional expectation and variance",
      "Descriptive statistics, correlation and covariance",
      "Random variables and probability mass functions",
      "Uniform, Bernoulli and binomial distributions",
      "Continuous random variables, PDF and conditional PDF",
      "Exponential and Poisson distributions",
      "Normal, standard normal, t and chi-squared distributions",
      "Cumulative distribution functions",
      "Central limit theorem",
      "Confidence intervals",
      "z-test, t-test and chi-squared test",
    ],
  },
  {
    id: "linear",
    name: "Linear Algebra",
    icon: "↗",
    topics: [
      "Vector spaces and subspaces",
      "Linear dependence and independence",
      "Matrices and their properties",
      "Projection, orthogonal and idempotent matrices",
      "Partition matrices",
      "Quadratic forms",
      "Systems of linear equations and Gaussian elimination",
      "Eigenvalues and eigenvectors",
      "Determinant, rank and nullity",
      "Projections",
      "LU decomposition",
      "Singular value decomposition",
    ],
  },
  {
    id: "calculus",
    name: "Calculus & Optimization",
    icon: "∫",
    topics: [
      "Functions of a single variable",
      "Limits and continuity",
      "Differentiability",
      "Taylor series",
      "Maxima and minima",
      "Single-variable optimization",
    ],
  },
  {
    id: "programming",
    name: "Programming & Algorithms",
    icon: "⌘",
    topics: [
      "Programming in Python",
      "Stacks and queues",
      "Linked lists",
      "Trees and hash tables",
      "Linear and binary search",
      "Selection, bubble and insertion sort",
      "Mergesort and quicksort",
      "Introduction to graph theory",
      "Graph traversals",
      "Shortest path algorithms",
    ],
  },
  {
    id: "database",
    name: "Databases & Warehousing",
    icon: "▤",
    topics: [
      "ER model",
      "Relational model",
      "Relational algebra and tuple calculus",
      "SQL",
      "Integrity constraints",
      "Normal forms",
      "File organization and indexing",
      "Data types and data transformation",
      "Normalization, discretization and sampling",
      "Compression",
      "Multidimensional warehouse schemas",
      "Concept hierarchies",
      "Measures: categorization and computations",
    ],
  },
  {
    id: "ml",
    name: "Machine Learning",
    icon: "✳",
    topics: [
      "Regression and classification",
      "Simple and multiple linear regression",
      "Ridge regression",
      "Logistic regression",
      "k-nearest neighbour",
      "Naive Bayes classifier",
      "Linear discriminant analysis",
      "Support vector machines",
      "Decision trees",
      "Bias-variance trade-off",
      "LOO and k-fold cross-validation",
      "Multi-layer perceptron and feed-forward neural networks",
      "k-means and k-medoid clustering",
      "Hierarchical clustering: top-down and bottom-up",
      "Single-linkage and multiple-linkage",
      "Dimensionality reduction and PCA",
    ],
  },
  {
    id: "ai",
    name: "Artificial Intelligence",
    icon: "⌁",
    topics: [
      "Informed and uninformed search",
      "Adversarial search",
      "Propositional logic",
      "Predicate logic",
      "Conditional independence representation",
      "Exact inference through variable elimination",
      "Approximate inference through sampling",
    ],
  },
];
export const levels = ["Low", "Medium", "High"];
export function nextDifficulty(current, correct, progressive) {
  return progressive
    ? Math.max(1, Math.min(3, current + (correct ? 1 : -1)))
    : current;
}
export function grade(q, answer) {
  if (q.type === "NAT") {
    return (
      typeof answer === "string" &&
      answer.trim() !== "" &&
      Number.isFinite(Number(answer)) &&
      Number(answer) >= q.numericMin &&
      Number(answer) <= q.numericMax
    );
  }
  return (
    Array.isArray(answer) &&
    answer.length === q.correctOptions.length &&
    [...answer].sort().every((x, i) => x === [...q.correctOptions].sort()[i])
  );
}
