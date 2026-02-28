export const pagination = (req, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    defaultSort = "id",
    defaultOrder = "asc",
  } = options;

  const page = Math.max(Number(req.query.page || defaultPage), 1);
  const limit = Math.max(Number(req.query.limit || defaultLimit), 1);
  const skip = (page - 1) * limit;

  const sort = String(req.query.sort || defaultSort);
  const order =
    String(req.query.order || defaultOrder).toLowerCase() === "desc"
      ? "desc"
      : "asc";

  return {
    page,
    limit,
    skip,
    sort,
    order,
  };
};
